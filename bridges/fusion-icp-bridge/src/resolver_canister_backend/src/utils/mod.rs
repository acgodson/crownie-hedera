use candid::Principal;
use sha2::{Digest, Sha256};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use crate::types::{ResolverError, ResolverResult};

/// Utility functions for the resolver canister
pub struct ResolverUtils;

impl ResolverUtils {
    /// Parse recipient from 1inch order (frontend already derived this)
    pub fn parse_icp_recipient(recipient_str: &str) -> ResolverResult<Principal> {
        Principal::from_text(recipient_str)
            .map_err(|e| ResolverError::InvalidInput(format!("Invalid recipient principal: {}", e)))
    }

    /// Generate deterministic hash for HTLC secret
    pub fn generate_secret_hash(secret: &[u8; 32]) -> [u8; 32] {
        let hash = Sha256::digest(secret);
        hash.into()
    }

    /// Hash secret for HTLC (alias for compatibility)
    pub fn hash_secret(secret: &[u8; 32]) -> [u8; 32] {
        Self::generate_secret_hash(secret)
    }

    /// Generate random secret for HTLC
    pub fn generate_htlc_secret() -> [u8; 32] {
        let timestamp = ic_cdk::api::time();
        let caller = ic_cdk::caller();
        
        let mut hasher = Sha256::new();
        hasher.update(b"htlc_secret:");
        hasher.update(timestamp.to_be_bytes());
        hasher.update(caller.as_slice());
        hasher.update(ic_cdk::api::instruction_counter().to_be_bytes());
        
        let hash = hasher.finalize();
        hash.into()
    }

    /// Generate idempotency key for HTTP requests
    pub fn generate_idempotency_key(content: &[u8]) -> String {
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        let hash = hasher.finish();
        format!(
            "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
            (hash >> 32) & 0xffffffff,
            (hash >> 16) & 0xffff,
            hash & 0xffff,
            (hash >> 48) & 0xffff,
            hash & 0xffffffffffff
        )
    }

    /// Validate token address format
    pub fn validate_token_address(address: &str) -> ResolverResult<()> {
        if address == "0x0000000000000000000000000000000000000000" {
            return Ok(()); // ETH address is valid
        }
        
        if !address.starts_with("0x") || address.len() != 42 {
            return Err(ResolverError::InvalidInput(
                "Invalid token address format".to_string()
            ));
        }
        
        // Check if all characters after 0x are valid hex
        if !address[2..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(ResolverError::InvalidInput(
                "Invalid hexadecimal characters in token address".to_string()
            ));
        }
        
        Ok(())
    }

    /// Calculate profitability score for an order
    pub fn calculate_profitability_score(
        making_amount: u128,
        taking_amount: u128,
        estimated_gas_cost: u128,
        current_eth_price: f64,
    ) -> f64 {
        if making_amount == 0 || taking_amount == 0 {
            return 0.0;
        }
        
        // Simple profitability calculation
        // This would be much more sophisticated in production
        let gross_profit = taking_amount.saturating_sub(making_amount);
        let net_profit = gross_profit.saturating_sub(estimated_gas_cost);
        
        if net_profit == 0 {
            return 0.0;
        }
        
        // Return profit as percentage of investment
        (net_profit as f64 / making_amount as f64) * 100.0
    }

    /// Check if an order is still valid (not expired)
    pub fn is_order_valid(time_lock: u64) -> bool {
        let current_time = ic_cdk::api::time();
        current_time < time_lock
    }

    /// Convert wei to ETH for display
    pub fn wei_to_eth(wei: u128) -> f64 {
        wei as f64 / 1_000_000_000_000_000_000.0
    }

    /// Convert ETH to wei
    pub fn eth_to_wei(eth: f64) -> u128 {
        (eth * 1_000_000_000_000_000_000.0) as u128
    }

    /// Format timestamp for logging
    pub fn format_timestamp(timestamp: u64) -> String {
        // Convert nanoseconds to seconds
        let seconds = timestamp / 1_000_000_000;
        format!("timestamp_{}", seconds)
    }

    /// Validate order hash format
    pub fn validate_order_hash(hash: &str) -> ResolverResult<()> {
        if hash.len() != 66 || !hash.starts_with("0x") {
            return Err(ResolverError::InvalidInput(
                "Invalid order hash format".to_string()
            ));
        }
        
        if !hash[2..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(ResolverError::InvalidInput(
                "Invalid hexadecimal characters in order hash".to_string()
            ));
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_icp_recipient() {
        let principal_str = "be2us-64aaa-aaaaa-qaabq-cai";
        let result = ResolverUtils::parse_icp_recipient(principal_str);
        assert!(result.is_ok());
        
        // Test invalid principal
        let invalid_result = ResolverUtils::parse_icp_recipient("invalid");
        assert!(invalid_result.is_err());
    }

    #[test]
    fn test_validate_token_address() {
        // Valid addresses
        assert!(ResolverUtils::validate_token_address("0x0000000000000000000000000000000000000000").is_ok());
        assert!(ResolverUtils::validate_token_address("0xA0b86a33E6441Fb4c6e62B85f0C6E3dF9C7fE0c5").is_ok());
        
        // Invalid addresses
        assert!(ResolverUtils::validate_token_address("invalid").is_err());
        assert!(ResolverUtils::validate_token_address("0x123").is_err());
    }

    #[test]
    fn test_wei_eth_conversion() {
        let wei_amount = 1_000_000_000_000_000_000u128; // 1 ETH in wei
        let eth_amount = ResolverUtils::wei_to_eth(wei_amount);
        assert_eq!(eth_amount, 1.0);
        
        let converted_back = ResolverUtils::eth_to_wei(eth_amount);
        assert_eq!(converted_back, wei_amount);
    }
}