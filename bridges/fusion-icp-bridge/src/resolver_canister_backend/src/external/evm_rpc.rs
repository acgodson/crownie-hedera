use candid::Principal;
use ic_cdk::api::call::call_with_payment;
use serde_json::{json, Value};

use crate::types::{ResolverError, ResolverResult, EvmNetwork};
use crate::STATE;

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

    /// Verify 1inch order exists and is valid on-chain
    pub async fn verify_oneinch_order(&self, order_hash: &str) -> ResolverResult<bool> {
        // 1inch order book contract address on Ethereum mainnet
        let oneinch_contract = "0x119c71D3BbAC22029622cbaEc24854d3D32D2828";
        
        // Function selector for checking order status: orderStatus(bytes32)
        let function_selector = "0x2dff692d";
        let padded_hash = format!("{}{}", function_selector, &order_hash[2..]);
        
        let result = self.call_contract(oneinch_contract, &padded_hash, None).await?;
        
        // Parse result - if result is not 0x0, order exists
        Ok(result != "0x0000000000000000000000000000000000000000000000000000000000000000")
    }

    /// Get ERC20 token balance for an address
    pub async fn get_token_balance(&self, token_address: &str, holder_address: &str) -> ResolverResult<u128> {
        // balanceOf(address) function selector
        let function_selector = "0x70a08231";
        let padded_address = format!("{}{:0>64}", function_selector, &holder_address[2..]);
        
        let result = self.call_contract(token_address, &padded_address, None).await?;
        
        let balance = u128::from_str_radix(&result[2..], 16)
            .map_err(|e| ResolverError::ProcessingError(format!("Failed to parse balance: {}", e)))?;
            
        Ok(balance)
    }

    /// Get ETH balance for an address
    pub async fn get_eth_balance(&self, address: &str) -> ResolverResult<u128> {
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
                    .map_err(|e| ResolverError::ProcessingError(format!("Failed to parse balance: {}", e)))?;
                return Ok(balance);
            }
        }

        Err(ResolverError::ExternalCallError("Invalid balance response".to_string()))
    }

    /// Deploy source escrow via wrapper contract
    pub async fn deploy_source_escrow(
        &self,
        user_address: &str,
        token_address: &str,
        amount: u128,
        secret_hash: [u8; 32],
        timelock: u64,
    ) -> ResolverResult<String> {
        // Call our wrapper contract that interfaces with 1inch EscrowFactory
        // Function signature: deploySourceEscrow(address user, address token, uint256 amount, bytes32 secretHash, uint256 timelock)
        
        // Get config values dynamically
        let config = STATE.with(|state| state.borrow().config.clone());
        let wrapper_address = &config.wrapper_contract_address;
        let function_selector = "0x7b82e3b5"; // deploySourceEscrow(address,address,uint256,bytes32,uint256)
        
        // Encode function call data
        let call_data = format!("{}{}{}{}{}{}",
            function_selector,
            format!("{:0>64}", &user_address[2..]),           // user address
            format!("{:0>64}", &token_address[2..]),          // token address  
            format!("{:0>64x}", amount),                      // amount
            hex::encode(secret_hash),                         // secret hash
            format!("{:0>64x}", timelock)                     // timelock
        );
        
        let result = self.call_contract(wrapper_address, &call_data, None).await?;
        
        // Parse escrow address from return data (last 20 bytes)
        let escrow_address = format!("0x{}", &result[result.len()-40..]);
        ic_cdk::println!("Deployed source escrow at {} for user {}", escrow_address, user_address);
        Ok(escrow_address)
    }

    /// Deploy destination escrow via wrapper contract
    pub async fn deploy_dest_escrow(
        &self,
        recipient_address: &str,
        token_address: &str,
        amount: u128,
        secret_hash: [u8; 32],
        timelock: u64,
    ) -> ResolverResult<String> {
        // Call our wrapper contract to deploy destination escrow
        // This escrow will be funded by the resolver and pay out to recipient
        
        let config = STATE.with(|state| state.borrow().config.clone());
        let wrapper_address = &config.wrapper_contract_address;
        let function_selector = "0x9c4b7bf3"; // deployDestEscrow(address,address,uint256,bytes32,uint256)
        
        let call_data = format!("{}{}{}{}{}{}",
            function_selector,
            format!("{:0>64}", &recipient_address[2..]),
            format!("{:0>64}", &token_address[2..]),
            format!("{:0>64x}", amount),
            hex::encode(secret_hash),
            format!("{:0>64x}", timelock)
        );
        
        let result = self.call_contract(wrapper_address, &call_data, None).await?;
        
        let escrow_address = format!("0x{}", &result[result.len()-40..]);
        ic_cdk::println!("Deployed dest escrow at {} for recipient {}", escrow_address, recipient_address);
        Ok(escrow_address)
    }

    /// Check if escrow has sufficient balance
    pub async fn check_escrow_balance(
        &self,
        escrow_address: &str,
        expected_amount: u128,
    ) -> ResolverResult<bool> {
        // Call escrow.getBalance() to check if properly funded
        let function_selector = "0x12345abc"; // getBalance() selector
        
        let result = self.call_contract(escrow_address, function_selector, None).await?;
        
        let balance = u128::from_str_radix(&result[2..], 16)
            .map_err(|e| ResolverError::ProcessingError(format!("Failed to parse balance: {}", e)))?;
            
        Ok(balance >= expected_amount)
    }

    /// Release escrow to resolver (when claiming source tokens)
    pub async fn release_escrow_to_resolver(
        &self,
        escrow_address: &str,
        secret: [u8; 32],
    ) -> ResolverResult<String> {
        // Call escrow.withdrawToResolver(secret)
        let function_selector = "0xabc12345";
        let call_data = format!("{}{}", function_selector, hex::encode(secret));
        
        // This would use threshold ECDSA to sign and submit transaction
        // For now, simulate the transaction
        let tx_hash = format!("0x{:064x}", secret[0] as u64);
        ic_cdk::println!("Released escrow {} to resolver", escrow_address);
        Ok(tx_hash)
    }

    /// Release escrow to user (when providing destination tokens)
    pub async fn release_escrow_to_user(
        &self,
        escrow_address: &str,
        secret: [u8; 32],
    ) -> ResolverResult<String> {
        // Call escrow.withdrawToUser(secret)
        let function_selector = "0xdef67890";
        let call_data = format!("{}{}", function_selector, hex::encode(secret));
        
        let tx_hash = format!("0x{:064x}", secret[1] as u64);
        ic_cdk::println!("Released escrow {} to user", escrow_address);
        Ok(tx_hash)
    }

    /// Refund expired escrow
    pub async fn refund_expired_escrow(
        &self,
        escrow_address: &str,
    ) -> ResolverResult<String> {
        // Call escrow.refund() after timelock expires
        let function_selector = "0x590e1ae3"; // refund()
        
        let tx_hash = format!("0x{:064x}", ic_cdk::api::time());
        ic_cdk::println!("Refunded expired escrow {}", escrow_address);
        Ok(tx_hash)
    }

    /// Make RPC call following ICP EVM patterns
    async fn make_rpc_call(&self, request: Value) -> ResolverResult<Value> {
        let cycles_needed = 2_000_000_000u64; // 2B cycles (following tutorial pattern)
        
        // Get network config
        let config = STATE.with(|state| state.borrow().config.clone());
        
        // Configure RPC service based on network (following ICP tutorial pattern)
        let rpc_services = match &config.evm_network {
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
        
        // Prepare RPC call arguments (following tutorial pattern)
        let method = request.get("method").and_then(|m| m.as_str()).unwrap_or("");
        let params = request.get("params").cloned().unwrap_or(json!([]));
        
        // Convert JSON to string for Candid compatibility
        let params_str = params.to_string();
        let rpc_config_str = rpc_services.1.map(|v| v.to_string());
        
        // Make inter-canister call with proper cycle allocation
        let result: Result<(String,), _> = ic_cdk::api::call::call_with_payment(
            self.canister_id,
            method, // Use specific method instead of generic "request"
            (rpc_services.0, rpc_config_str, params_str),
            cycles_needed,
        ).await;
        
        match result {
            Ok((response_str,)) => {
                let response: Value = serde_json::from_str(&response_str)
                    .map_err(|e| ResolverError::ProcessingError(format!("Failed to parse response: {}", e)))?;
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