use candid::Principal;
use ic_cdk::api::call::call_with_payment;
use serde_json::{json, Value};

use crate::types::{ResolverError, ResolverResult, CrossChainOrder};

/// EVM RPC client for blockchain interactions via ICP's EVM RPC canister
/// 
/// Responsibilities:
/// - Submit transactions to Ethereum (HTLC creation, bidding)
/// - Query blockchain state (gas prices, block numbers, balances)
/// - Verify transaction receipts and status
/// - Handle threshold ECDSA signing
/// - Smart contract interactions
/// 
/// NOT responsible for:
/// - Order discovery (use HttpClient with 1inch API)
/// - Price quotes (use HttpClient with 1inch API)
/// - Market data (use HttpClient for external APIs)
pub struct EvmRpcClient {
    pub canister_id: Principal,
    pub provider_config: RpcProviderConfig,
}

#[derive(Clone, Debug)]
pub enum RpcProviderConfig {
    /// Use consensus across multiple built-in providers (Alchemy, Ankr, BlockPi)
    EthMainnet,
    /// Use Polygon mainnet providers
    Polygon,
    /// Use custom Alchemy endpoint with your API key
    CustomAlchemy(String),
    /// Use any custom RPC URL
    Custom(String),
}

impl EvmRpcClient {
    /// Create new EVM RPC client with default Ethereum mainnet providers
    pub fn new(canister_id: Principal) -> Self {
        Self { 
            canister_id,
            provider_config: RpcProviderConfig::EthMainnet,
        }
    }

    /// Create EVM RPC client with custom Alchemy API key
    pub fn new_with_alchemy(canister_id: Principal, api_key: String) -> Self {
        Self {
            canister_id,
            provider_config: RpcProviderConfig::CustomAlchemy(api_key),
        }
    }

    /// Create EVM RPC client with custom provider URL
    pub fn new_with_custom_provider(canister_id: Principal, url: String) -> Self {
        Self {
            canister_id,
            provider_config: RpcProviderConfig::Custom(url),
        }
    }


    pub async fn get_latest_block_number(&self) -> ResolverResult<u64> {
        let request = json!({
            "jsonrpc": "2.0",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        });

        let response = self.make_rpc_call(request).await?;
        
        if let Some(result) = response.get("result") {
            if let Some(block_hex) = result.as_str() {
                let block_number = u64::from_str_radix(&block_hex[2..], 16)
                    .map_err(|e| ResolverError::ProcessingError(format!("Failed to parse block number: {}", e)))?;
                return Ok(block_number);
            }
        }

        Err(ResolverError::ExternalCallError("Invalid block number response".to_string()))
    }


    pub async fn get_logs(
        &self,
        contract_address: &str,
        from_block: u64,
        to_block: Option<u64>,
        topics: Vec<String>,
    ) -> ResolverResult<Vec<Value>> {
        let to_block_param = to_block
            .map(|b| json!(format!("0x{:x}", b)))
            .unwrap_or(json!("latest"));

        let request = json!({
            "jsonrpc": "2.0",
            "method": "eth_getLogs",
            "params": [{
                "address": contract_address,
                "fromBlock": format!("0x{:x}", from_block),
                "toBlock": to_block_param,
                "topics": topics
            }],
            "id": 1
        });

        let response = self.make_rpc_call(request).await?;
        
        if let Some(result) = response.get("result") {
            if let Some(logs) = result.as_array() {
                return Ok(logs.clone());
            }
        }

        Err(ResolverError::ExternalCallError("Invalid logs response".to_string()))
    }


    pub async fn get_transaction_receipt(&self, tx_hash: &str) -> ResolverResult<Value> {
        let request = json!({
            "jsonrpc": "2.0",
            "method": "eth_getTransactionReceipt",
            "params": [tx_hash],
            "id": 1
        });

        let response = self.make_rpc_call(request).await?;
        
        if let Some(result) = response.get("result") {
            return Ok(result.clone());
        }

        Err(ResolverError::ExternalCallError("Transaction receipt not found".to_string()))
    }


    pub async fn send_raw_transaction(&self, signed_tx: &str) -> ResolverResult<String> {
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
            return Err(ResolverError::ExternalCallError(format!(
                "Transaction failed: {}", error
            )));
        }

        Err(ResolverError::ExternalCallError("Invalid transaction response".to_string()))
    }


    pub async fn call_contract(
        &self,
        contract_address: &str,
        data: &str,
        block: Option<u64>,
    ) -> ResolverResult<String> {
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

        Err(ResolverError::ExternalCallError("Invalid contract call response".to_string()))
    }


    pub async fn get_gas_price(&self) -> ResolverResult<u128> {
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
                    .map_err(|e| ResolverError::ProcessingError(format!("Failed to parse gas price: {}", e)))?;
                return Ok(gas_price);
            }
        }

        Err(ResolverError::ExternalCallError("Invalid gas price response".to_string()))
    }


    pub async fn get_transaction_count(&self, address: &str) -> ResolverResult<u64> {
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
                    .map_err(|e| ResolverError::ProcessingError(format!("Failed to parse nonce: {}", e)))?;
                return Ok(nonce);
            }
        }

        Err(ResolverError::ExternalCallError("Invalid nonce response".to_string()))
    }


    /// Verify transaction settlement on Ethereum (used after winning auction)
    pub async fn verify_transaction_settlement(&self, tx_hash: &str) -> ResolverResult<bool> {
        let receipt = self.get_transaction_receipt(tx_hash).await?;
        
        // Check if transaction was successful
        if let Some(status) = receipt.get("status") {
            if let Some(status_str) = status.as_str() {
                return Ok(status_str == "0x1");
            }
        }
        
        Ok(false)
    }

    /// Create HTLC contract on Ethereum
    pub async fn create_ethereum_htlc(
        &self,
        _order: &CrossChainOrder,
    ) -> ResolverResult<String> {
        // TODO: Implement HTLC contract creation
        // This requires:
        // 1. Building transaction data for HTLC contract deployment/call
        // 2. Signing transaction with threshold ECDSA
        // 3. Submitting signed transaction
        
        // Placeholder implementation
        Ok("0x1234567890123456789012345678901234567890".to_string())
    }

    /// Make RPC call to EVM canister
    async fn make_rpc_call(&self, request: Value) -> ResolverResult<Value> {
        let cycles_needed = 1_000_000_000u64; // 1B cycles for EVM RPC call
        
        // Convert JSON request to string
        let request_str = request.to_string();
        
        // Configure RPC service based on provider config
        let rpc_service = match &self.provider_config {
            RpcProviderConfig::EthMainnet => {
                json!({"Chain": "0x1"})  // Uses consensus across Alchemy, Ankr, BlockPi
            }
            RpcProviderConfig::Polygon => {
                json!({"Chain": "0x89"})  // Polygon mainnet
            }
            RpcProviderConfig::CustomAlchemy(api_key) => {
                json!({
                    "Custom": {
                        "url": format!("https://eth-mainnet.alchemyapi.io/v2/{}", api_key)
                    }
                })
            }
            RpcProviderConfig::Custom(url) => {
                json!({
                    "Custom": {
                        "url": url
                    }
                })
            }
        };
        
        // Convert Value to string for Candid compatibility
        let rpc_service_str = rpc_service.to_string();
        
        // Make inter-canister call to EVM RPC canister
        let result: Result<(String,), _> = call_with_payment(
            self.canister_id,
            "request",
            (rpc_service_str, request_str, 1000u64),
            cycles_needed,
        ).await;
        
        match result {
            Ok((response_str,)) => {
                // Parse the response string back to JSON
                let response: Value = serde_json::from_str(&response_str)
                    .map_err(|e| ResolverError::ProcessingError(format!("Failed to parse response: {}", e)))?;
                
                // Check for JSON-RPC error
                if let Some(error) = response.get("error") {
                    return Err(ResolverError::ExternalCallError(format!(
                        "EVM RPC error: {}", error
                    )));
                }
                Ok(response)
            }
            Err((code, msg)) => Err(ResolverError::ExternalCallError(format!(
                "EVM RPC call failed: {:?} - {}", code, msg
            )))
        }
    }
}

impl Default for EvmRpcClient {
    fn default() -> Self {
        Self::new(Principal::from_text("7hfb6-caaaa-aaaar-qadga-cai").unwrap())
    }
}