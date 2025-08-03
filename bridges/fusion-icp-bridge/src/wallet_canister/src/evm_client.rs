use candid::Principal;
use ic_cdk::api::call::call_with_payment;
use serde_json::{json, Value};

use crate::types::{EvmNetwork, WalletError, WalletResult};

pub struct EvmClient {
    pub canister_id: Principal,
    pub network: EvmNetwork,
}

impl EvmClient {
    pub fn new(canister_id: Principal, network: EvmNetwork) -> Self {
        Self { canister_id, network }
    }
    
    pub async fn get_eth_balance(&self, address: &str) -> WalletResult<u128> {
        let request = json!({
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [address, "latest"],
            "id": 1
        });

        let response = self.make_rpc_call(request).await?;
        
        if let Some(result) = response.get("result") {
            if let Some(balance_hex) = result.as_str() {
                let balance = u128::from_str_radix(&balance_hex[2..], 16)
                    .map_err(|e| WalletError::ProcessingError(format!("Failed to parse balance: {}", e)))?;
                return Ok(balance);
            }
        }

        Err(WalletError::ExternalCallError("Invalid balance response".to_string()))
    }
    
    pub async fn get_token_balance(&self, token_address: &str, holder_address: &str) -> WalletResult<u128> {
        // balanceOf(address) function selector
        let function_selector = "0x70a08231";
        let padded_address = format!("{}{:0>64}", function_selector, &holder_address[2..]);
        
        let result = self.call_contract(token_address, &padded_address, None).await?;
        
        let balance = u128::from_str_radix(&result[2..], 16)
            .map_err(|e| WalletError::ProcessingError(format!("Failed to parse balance: {}", e)))?;
            
        Ok(balance)
    }
    
    pub async fn get_gas_price(&self) -> WalletResult<u128> {
        let request = json!({
            "jsonrpc": "2.0",
            "method": "eth_gasPrice",
            "params": [],
            "id": 1
        });

        let response = self.make_rpc_call(request).await?;
        
        if let Some(result) = response.get("result") {
            if let Some(gas_price_hex) = result.as_str() {
                let gas_price = u128::from_str_radix(&gas_price_hex[2..], 16)
                    .map_err(|e| WalletError::ProcessingError(format!("Failed to parse gas price: {}", e)))?;
                return Ok(gas_price);
            }
        }

        Err(WalletError::ExternalCallError("Invalid gas price response".to_string()))
    }
    
    pub async fn get_transaction_count(&self, address: &str) -> WalletResult<u64> {
        let request = json!({
            "jsonrpc": "2.0",
            "method": "eth_getTransactionCount",
            "params": [address, "latest"],
            "id": 1
        });

        let response = self.make_rpc_call(request).await?;
        
        if let Some(result) = response.get("result") {
            if let Some(nonce_hex) = result.as_str() {
                let nonce = u64::from_str_radix(&nonce_hex[2..], 16)
                    .map_err(|e| WalletError::ProcessingError(format!("Failed to parse nonce: {}", e)))?;
                return Ok(nonce);
            }
        }

        Err(WalletError::ExternalCallError("Invalid nonce response".to_string()))
    }
    
    pub async fn call_contract(
        &self,
        contract_address: &str,
        data: &str,
        block: Option<u64>,
    ) -> WalletResult<String> {
        let block_param = block
            .map(|b| json!(format!("0x{:x}", b)))
            .unwrap_or(json!("latest"));

        let request = json!({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{
                "to": contract_address,
                "data": data
            }, block_param],
            "id": 1
        });

        let response = self.make_rpc_call(request).await?;
        
        if let Some(result) = response.get("result") {
            if let Some(data) = result.as_str() {
                return Ok(data.to_string());
            }
        }

        Err(WalletError::ExternalCallError("Invalid contract call response".to_string()))
    }
    
    pub async fn send_raw_transaction(&self, signed_tx: &str) -> WalletResult<String> {
        let request = json!({
            "jsonrpc": "2.0",
            "method": "eth_sendRawTransaction",
            "params": [signed_tx],
            "id": 1
        });

        let response = self.make_rpc_call(request).await?;
        
        if let Some(result) = response.get("result") {
            if let Some(tx_hash) = result.as_str() {
                return Ok(tx_hash.to_string());
            }
        }

        if let Some(error) = response.get("error") {
            return Err(WalletError::ExternalCallError(format!(
                "Transaction failed: {}", error
            )));
        }

        Err(WalletError::ExternalCallError("Invalid transaction response".to_string()))
    }
    
    async fn make_rpc_call(&self, request: Value) -> WalletResult<Value> {
        let cycles_needed = 2_000_000_000u64; // 2B cycles
        
        // Configure RPC service based on network
        let rpc_services = match &self.network {
            EvmNetwork::EthMainnet => ("EthMainnet", None),
            EvmNetwork::EthSepolia => ("EthSepolia", None), 
            EvmNetwork::Polygon => ("Polygon", None),
            EvmNetwork::Base => ("Base", None),
            EvmNetwork::Custom { chain_id, rpc_url } => {
                ("Custom", Some(json!({
                    "chainId": chain_id,
                    "services": [{
                        "url": rpc_url,
                        "headers": null
                    }]
                })))
            }
        };
        
        // Prepare RPC call arguments
        let method = request.get("method").and_then(|m| m.as_str()).unwrap_or("");
        let params = request.get("params").cloned().unwrap_or(json!([]));
        
        // Convert JSON to string for Candid compatibility
        let params_str = params.to_string();
        
        // Make inter-canister call with proper cycle allocation
        let result: Result<(String,), _> = call_with_payment(
            self.canister_id,
            method,
            (rpc_services.0, rpc_services.1, params_str),
            cycles_needed,
        ).await;
        
        match result {
            Ok((response_str,)) => {
                let response: Value = serde_json::from_str(&response_str)
                    .map_err(|e| WalletError::ProcessingError(format!("Failed to parse response: {}", e)))?;
                Ok(response)
            }
            Err((code, msg)) => Err(WalletError::ExternalCallError(format!(
                "EVM RPC call failed: {:?} - {}", code, msg
            )))
        }
    }
}