use candid::Principal;
use serde_json::{json, Value};
use ic_cdk::api::management_canister::ecdsa::{
    EcdsaKeyId, EcdsaPublicKeyArgument, EcdsaPublicKeyResponse, EcdsaCurve,
    SignWithEcdsaArgument, SignWithEcdsaResponse,
};
use crate::types::{ResolverError, ResolverResult, EvmNetwork};
use crate::STATE;


pub struct EvmRpcClient {
    pub canister_id: Principal,
}

pub enum ResolverFunction {
    DeploySrc,
    DeployDst, 
    Withdraw,
    Cancel,
    ArbitraryCalls,
}

impl ResolverFunction {
    fn selector(&self) -> &'static str {
        match self {
            ResolverFunction::DeploySrc => "0x7b12345a", 
            ResolverFunction::DeployDst => "0x8c23456b", 
            ResolverFunction::Withdraw => "0x9d34567c",  
            ResolverFunction::Cancel => "0xae45678d",  
            ResolverFunction::ArbitraryCalls => "0xbf56789e", 
        }
    }
}

impl EvmRpcClient {
    pub fn new(canister_id: Principal) -> Self {
        Self { canister_id }
    }


    pub async fn deploy_source_escrow(
        &self,
        user_address: &str,
        token_address: &str,
        amount: u128,
        secret_hash: [u8; 32],
        timelock: u64,
    ) -> ResolverResult<String> {
        let config = STATE.with(|state| state.borrow().config.clone());
        let resolver_address = &config.oneinch_resolver_address;
        
        let order = self.build_fusion_order(
            user_address,
            token_address, 
            amount,
            secret_hash,
        ).await?;
        
        let immutables = self.build_immutables(
            &order.order_hash,
            secret_hash,
            user_address,           
            &self.get_resolver_eth_address().await?, 
            token_address,
            amount,
            timelock,
        ).await?;
        
        let (r, vs) = self.get_order_signature(&order).await?;
        
        let taker_traits = self.build_taker_traits().await?;
        
        let args = vec![]; 
        
        let call_data = self.encode_deploy_src(
            &immutables,
            &order,
            r,
            vs,
            amount,
            taker_traits,
            &args,
        )?;
    
        let safety_deposit = immutables.safety_deposit;
        
        let tx_hash = self.submit_signed_transaction(
            resolver_address,
            &call_data,
            safety_deposit,
        ).await?;
        
        let escrow_address = self.get_escrow_address_from_logs(&tx_hash, "SrcEscrowCreated").await?;
        
        ic_cdk::println!("Deployed source escrow via 1inch Resolver: {}", escrow_address);
        Ok(escrow_address)
    }

    pub async fn deploy_dest_escrow(
        &self,
        recipient_address: &str,
        token_address: &str,
        amount: u128,
        secret_hash: [u8; 32],
        timelock: u64,
    ) -> ResolverResult<String> {
        let config = STATE.with(|state| state.borrow().config.clone());
        let resolver_address = &config.oneinch_resolver_address;
        

        let dst_immutables = self.build_immutables(
            &self.generate_order_hash(recipient_address, token_address, amount, secret_hash).await?,
            secret_hash,
            &self.get_resolver_eth_address().await?, 
            recipient_address,                    
            token_address,
            amount,
            timelock,
        ).await?;

        let src_cancellation_timestamp = timelock + 3600; 
        
        let call_data = self.encode_deploy_dst(
            &dst_immutables,
            src_cancellation_timestamp,
        )?;
        
        let safety_deposit = dst_immutables.safety_deposit;
        
        let tx_hash = self.submit_signed_transaction(
            resolver_address,
            &call_data,
            safety_deposit,
        ).await?;
        
        let escrow_address = self.get_escrow_address_from_logs(&tx_hash, "DstEscrowCreated").await?;
        
        ic_cdk::println!("Deployed dest escrow via 1inch Resolver: {}", escrow_address);
        Ok(escrow_address)
    }

    pub async fn release_escrow_to_resolver(
        &self,
        escrow_address: &str,
        secret: [u8; 32],
        immutables: &OneInchImmutables,
    ) -> ResolverResult<String> {
        let config = STATE.with(|state| state.borrow().config.clone());
        let resolver_address = &config.oneinch_resolver_address;
     
        let call_data = self.encode_withdraw(
            escrow_address,
            secret,
            immutables,
        )?;
        
        let tx_hash = self.submit_signed_transaction(
            resolver_address,
            &call_data,
            0, 
        ).await?;
        
        ic_cdk::println!("Withdrew from escrow {} via 1inch Resolver", escrow_address);
        Ok(tx_hash)
    }

   
    pub async fn refund_expired_escrow(
        &self,
        escrow_address: &str,
        immutables: &OneInchImmutables,
    ) -> ResolverResult<String> {
        let config = STATE.with(|state| state.borrow().config.clone());
        let resolver_address = &config.oneinch_resolver_address;
        
        let call_data = self.encode_cancel(
            escrow_address,
            immutables,
        )?;
        
        let tx_hash = self.submit_signed_transaction(
            resolver_address,
            &call_data,
            0,
        ).await?;
        
        Ok(tx_hash)
    }

    pub async fn fund_dest_escrow(
        &self,
        escrow_address: &str,
        token_address: &str,
        amount: u128,
    ) -> ResolverResult<String> {
        if token_address == "0x0000000000000000000000000000000000000000" {

            self.send_eth_to_address(escrow_address, amount).await
        } else {
            // Send ERC20 tokens to escrow
            self.send_erc20_to_address(token_address, escrow_address, amount).await
        }
    }

    /// Check escrow balance
    pub async fn check_escrow_balance(
        &self,
        escrow_address: &str,
        expected_amount: u128,
    ) -> ResolverResult<bool> {
        // Call escrow contract directly to check balance
        let balance = self.get_eth_balance(escrow_address).await?;
        Ok(balance >= expected_amount)
    }

    /// Build 1inch Fusion Order struct
    async fn build_fusion_order(
        &self,
        user_address: &str,
        token_address: &str,
        amount: u128,
        secret_hash: [u8; 32],
    ) -> ResolverResult<OneInchOrder> {
        let order_hash = self.generate_order_hash(user_address, token_address, amount, secret_hash).await?;
        
        Ok(OneInchOrder {
            order_hash,
            salt: ic_cdk::api::time(),
            maker: user_address.to_string(),
            receiver: user_address.to_string(),
            making_token: token_address.to_string(),
            taking_token: "0x0000000000000000000000000000000000000000".to_string(), // Mock token for cross-chain
            making_amount: amount,
            taking_amount: 1, // Minimal amount for cross-chain
            maker_traits: 0,
        })
    }

    /// Build 1inch Immutables struct  
    pub async fn build_immutables(
        &self,
        order_hash: &[u8; 32],
        hash_lock: [u8; 32],
        maker: &str,
        taker: &str,
        token: &str,
        amount: u128,
        timelock: u64,
    ) -> ResolverResult<OneInchImmutables> {
        Ok(OneInchImmutables {
            order_hash: *order_hash,
            hash_lock,
            maker: maker.to_string(),
            taker: taker.to_string(), 
            token: token.to_string(),
            amount,
            safety_deposit: 1000000000000000u128, // 0.001 ETH
            timelocks: self.build_timelocks(timelock),
        })
    }

    /// Build 1inch Timelocks
    fn build_timelocks(&self, base_timelock: u64) -> u64 {
        // 1inch timelock format - packed timestamps
        // This is simplified - real implementation needs proper timelock encoding
        base_timelock
    }

    /// Build TakerTraits for 1inch
    async fn build_taker_traits(&self) -> ResolverResult<u128> {
        // TakerTraits with _ARGS_HAS_TARGET bit set (1 << 251)
        Ok(1u128 << 127) // Simplified representation
    }

    /// Get order signature (would be provided by user)
    async fn get_order_signature(&self, order: &OneInchOrder) -> ResolverResult<([u8; 32], [u8; 32])> {
        // In real implementation, user signs the order off-chain
        // For demo, generate mock signature
        let r = [1u8; 32];
        let vs = [2u8; 32];
        Ok((r, vs))
    }

    /// Encode deploySrc function call
    fn encode_deploy_src(
        &self,
        immutables: &OneInchImmutables,
        order: &OneInchOrder,
        r: [u8; 32],
        vs: [u8; 32],
        amount: u128,
        taker_traits: u128,
        args: &[u8],
    ) -> ResolverResult<String> {
        // Encode according to 1inch Resolver.deploySrc signature
        let mut encoded = String::from(ResolverFunction::DeploySrc.selector());
        
        // Encode immutables
        encoded.push_str(&self.encode_immutables_struct(immutables));
        
        // Encode order  
        encoded.push_str(&self.encode_order_struct(order));
        
        // Encode signature components
        encoded.push_str(&hex::encode(r));
        encoded.push_str(&hex::encode(vs));
        
        // Encode amount
        encoded.push_str(&format!("{:0>64x}", amount));
        
        // Encode taker traits
        encoded.push_str(&format!("{:0>64x}", taker_traits));
        
        // Encode args (bytes)
        encoded.push_str(&self.encode_bytes(args));
        
        Ok(encoded)
    }

    /// Encode deployDst function call
    fn encode_deploy_dst(
        &self,
        dst_immutables: &OneInchImmutables,
        src_cancellation_timestamp: u64,
    ) -> ResolverResult<String> {
        let mut encoded = String::from(ResolverFunction::DeployDst.selector());
        encoded.push_str(&self.encode_immutables_struct(dst_immutables));
        encoded.push_str(&format!("{:0>64x}", src_cancellation_timestamp));
        Ok(encoded)
    }

    /// Encode withdraw function call
    fn encode_withdraw(
        &self,
        escrow_address: &str,
        secret: [u8; 32],
        immutables: &OneInchImmutables,
    ) -> ResolverResult<String> {
        let mut encoded = String::from(ResolverFunction::Withdraw.selector());
        encoded.push_str(&format!("{:0>64}", &escrow_address[2..])); // IEscrow address
        encoded.push_str(&hex::encode(secret)); // bytes32 secret
        encoded.push_str(&self.encode_immutables_struct(immutables));
        Ok(encoded)
    }

    /// Encode cancel function call  
    fn encode_cancel(
        &self,
        escrow_address: &str,
        immutables: &OneInchImmutables,
    ) -> ResolverResult<String> {
        let mut encoded = String::from(ResolverFunction::Cancel.selector());
        encoded.push_str(&format!("{:0>64}", &escrow_address[2..]));
        encoded.push_str(&self.encode_immutables_struct(immutables));
        Ok(encoded)
    }

    /// Encode 1inch Immutables struct
    fn encode_immutables_struct(&self, immutables: &OneInchImmutables) -> String {
        format!("{}{}{}{}{}{}{}{}",
            hex::encode(immutables.order_hash),
            hex::encode(immutables.hash_lock),
            format!("{:0>64}", &immutables.maker[2..]),
            format!("{:0>64}", &immutables.taker[2..]),
            format!("{:0>64}", &immutables.token[2..]),
            format!("{:0>64x}", immutables.amount),
            format!("{:0>64x}", immutables.safety_deposit),
            format!("{:0>64x}", immutables.timelocks)
        )
    }

    /// Encode 1inch Order struct
    fn encode_order_struct(&self, order: &OneInchOrder) -> String {
        // Simplified order encoding - real implementation needs full Order struct
        format!("{}{}{}{}{}{}{}{}{}",
            format!("{:0>64x}", order.salt),
            format!("{:0>64}", &order.maker[2..]),
            format!("{:0>64}", &order.receiver[2..]),
            format!("{:0>64}", &order.making_token[2..]),
            format!("{:0>64}", &order.taking_token[2..]),
            format!("{:0>64x}", order.making_amount),
            format!("{:0>64x}", order.taking_amount),
            format!("{:0>64x}", order.maker_traits),
            "0000000000000000000000000000000000000000000000000000000000000000" // Extension placeholder
        )
    }

    /// Encode bytes for Solidity
    fn encode_bytes(&self, data: &[u8]) -> String {
        let len = data.len();
        let mut encoded = format!("{:0>64x}", len);
        encoded.push_str(&hex::encode(data));
        // Pad to 32-byte boundary
        let padding = (32 - (len % 32)) % 32;
        encoded.push_str(&"0".repeat(padding * 2));
        encoded
    }

    /// Submit signed transaction using threshold ECDSA
    async fn submit_signed_transaction(
        &self,
        to_address: &str,
        call_data: &str,
        value: u128,
    ) -> ResolverResult<String> {
        // Get resolver's ETH address from threshold ECDSA
        let from_address = self.get_resolver_eth_address().await?;
        
        // Get nonce
        let nonce = self.get_transaction_count(&from_address).await?;
        
        // Get gas price and estimate gas
        let gas_price = self.get_gas_price().await?;
        let gas_limit = 500_000u128; // Higher limit for complex 1inch calls
        
        // Build raw transaction
        let raw_tx = self.build_raw_transaction(
            nonce,
            gas_price,
            gas_limit,
            to_address,
            value,
            call_data,
        ).await?;
        
        // Sign with threshold ECDSA
        let signed_tx = self.sign_raw_transaction(&raw_tx).await?;
        
        // Submit to network
        self.send_raw_transaction(&signed_tx).await
    }

    /// Get resolver's Ethereum address from threshold ECDSA
    pub async fn get_resolver_eth_address(&self) -> ResolverResult<String> {
        let config = STATE.with(|state| state.borrow().config.clone());
        
        let public_key_result = ic_cdk::call(
            Principal::management_canister(),
            "ecdsa_public_key",
            (EcdsaPublicKeyArgument {
                canister_id: None,
                derivation_path: vec![],
                key_id: EcdsaKeyId {
                    curve: EcdsaCurve::Secp256k1,
                    name: config.ecdsa_key_name,
                },
            },)
        ).await;
        
        match public_key_result {
            Ok((response,)) => {
                let public_key_response: EcdsaPublicKeyResponse = response;
                let eth_address = self.public_key_to_eth_address(&public_key_response.public_key);
                Ok(eth_address)
            }
            Err((code, msg)) => Err(ResolverError::ExternalCallError(format!(
                "Failed to get public key: {:?} - {}", code, msg
            )))
        }
    }

    /// Convert public key to Ethereum address
    fn public_key_to_eth_address(&self, public_key: &[u8]) -> String {
        use sha3::{Digest, Keccak256};
        
        // Remove 0x04 prefix from uncompressed public key
        let public_key_bytes = &public_key[1..];
        
        // Hash with Keccak256
        let hash = Keccak256::digest(public_key_bytes);
        
        // Take last 20 bytes as Ethereum address
        let address_bytes = &hash[12..];
        format!("0x{}", hex::encode(address_bytes))
    }

    /// Send ETH to address
    async fn send_eth_to_address(&self, to_address: &str, amount: u128) -> ResolverResult<String> {
        let from_address = self.get_resolver_eth_address().await?;
        let nonce = self.get_transaction_count(&from_address).await?;
        let gas_price = self.get_gas_price().await?;
        let gas_limit = 21000u128; // Standard ETH transfer gas
        
        let raw_tx = self.build_raw_transaction(
            nonce,
            gas_price,
            gas_limit,
            to_address,
            amount,
            "",
        ).await?;
        
        let signed_tx = self.sign_raw_transaction(&raw_tx).await?;
        self.send_raw_transaction(&signed_tx).await
    }

    /// Send ERC20 tokens to address
    async fn send_erc20_to_address(&self, token_address: &str, to_address: &str, amount: u128) -> ResolverResult<String> {
        // ERC20 transfer function signature: transfer(address,uint256)
        let transfer_selector = "0xa9059cbb";
        let recipient_param = format!("{:0>64}", &to_address[2..]);
        let amount_param = format!("{:0>64x}", amount);
        let call_data = format!("{}{}{}", transfer_selector, recipient_param, amount_param);
        
        let from_address = self.get_resolver_eth_address().await?;
        let nonce = self.get_transaction_count(&from_address).await?;
        let gas_price = self.get_gas_price().await?;
        let gas_limit = 100000u128; // ERC20 transfer gas
        
        let raw_tx = self.build_raw_transaction(
            nonce,
            gas_price,
            gas_limit,
            token_address,
            0, // No ETH value for token transfer
            &call_data,
        ).await?;
        
        let signed_tx = self.sign_raw_transaction(&raw_tx).await?;
        self.send_raw_transaction(&signed_tx).await
    }

    /// Get ETH balance of address
    async fn get_eth_balance(&self, address: &str) -> ResolverResult<u128> {
        // Mock implementation - in real version would call eth_getBalance via EVM RPC
        Ok(1000000000000000000u128) // 1 ETH
    }

    /// Generate order hash for 1inch order
    pub async fn generate_order_hash(&self, user_address: &str, token_address: &str, amount: u128, secret_hash: [u8; 32]) -> ResolverResult<[u8; 32]> {
        use sha3::{Digest, Keccak256};
        
        let mut hasher = Keccak256::new();
        hasher.update(user_address.as_bytes());
        hasher.update(token_address.as_bytes());
        hasher.update(amount.to_be_bytes());
        hasher.update(secret_hash);
        
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        Ok(hash)
    }

    /// Get transaction count (nonce) for address
    async fn get_transaction_count(&self, address: &str) -> ResolverResult<u64> {
        // Mock implementation - in real version would call eth_getTransactionCount via EVM RPC
        Ok(1)
    }

    /// Get current gas price
    async fn get_gas_price(&self) -> ResolverResult<u128> {
        // Mock implementation - in real version would call eth_gasPrice via EVM RPC  
        Ok(20000000000u128) // 20 gwei
    }

    /// Build raw transaction
    async fn build_raw_transaction(
        &self,
        nonce: u64,
        gas_price: u128,
        gas_limit: u128,
        to: &str,
        value: u128,
        data: &str,
    ) -> ResolverResult<String> {
        // Mock implementation - in real version would build proper RLP-encoded transaction
        let tx = format!("{{\"nonce\":{},\"gasPrice\":{},\"gasLimit\":{},\"to\":\"{}\",\"value\":{},\"data\":\"{}\"}}",
            nonce, gas_price, gas_limit, to, value, data);
        Ok(tx)
    }

    /// Sign raw transaction with threshold ECDSA
    async fn sign_raw_transaction(&self, raw_tx: &str) -> ResolverResult<String> {
        // Mock implementation - in real version would sign with threshold ECDSA
        Ok(format!("0xsigned_{}", raw_tx))
    }

    /// Send raw transaction to network
    async fn send_raw_transaction(&self, signed_tx: &str) -> ResolverResult<String> {
        // Mock implementation - in real version would call eth_sendRawTransaction via EVM RPC
        Ok(format!("0x{:x}", ic_cdk::api::time()))
    }

    /// Get escrow address from transaction logs
    async fn get_escrow_address_from_logs(&self, tx_hash: &str, event_name: &str) -> ResolverResult<String> {
        // Mock implementation - in real version would parse transaction receipt logs
        Ok(format!("0x{:x}{:x}", ic_cdk::api::time(), event_name.len()))
    }

    /// Add method to release escrow to user (was missing)
    pub async fn release_escrow_to_user(
        &self,
        escrow_address: &str,
        secret: [u8; 32],
    ) -> ResolverResult<String> {
        // For user withdrawal, we encode a simpler withdraw call
        let call_data = self.encode_user_withdraw(escrow_address, secret)?;
        
        let tx_hash = self.submit_signed_transaction(
            escrow_address, // Send to escrow contract directly
            &call_data,
            0,
        ).await?;
        
        Ok(tx_hash)
    }

    /// Encode user withdraw function call
    fn encode_user_withdraw(&self, escrow_address: &str, secret: [u8; 32]) -> ResolverResult<String> {
        // Simple withdraw function selector
        let withdraw_selector = "0x2e1a7d4d"; // Standard withdraw selector
        let mut encoded = String::from(withdraw_selector);
        encoded.push_str(&hex::encode(secret));
        Ok(encoded)
    }
}

/// 1inch data structures
#[derive(Debug, Clone)]
pub struct OneInchOrder {
    pub order_hash: [u8; 32],
    pub salt: u64,
    pub maker: String,
    pub receiver: String,
    pub making_token: String,
    pub taking_token: String,
    pub making_amount: u128,
    pub taking_amount: u128,
    pub maker_traits: u64,
}

#[derive(Debug, Clone)]
pub struct OneInchImmutables {
    pub order_hash: [u8; 32],
    pub hash_lock: [u8; 32],
    pub maker: String,
    pub taker: String,
    pub token: String,
    pub amount: u128,
    pub safety_deposit: u128,
    pub timelocks: u64,
}