use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs,
    TransformContext, TransformFunc,
};
use ic_cdk_macros::query;
use serde_json;

use crate::types::{
    ResolverError, ResolverResult, OneInchOrder, OneInchQuoteResponse
};
use crate::utils::ResolverUtils;

/// HTTP client for 1inch Fusion+ API interactions
/// 
/// Responsibilities:
/// - Fetch active orders from 1inch Fusion+ API
/// - Get price quotes for profitability analysis  
/// - Submit auction bids via API (if supported)
/// - Handle cycle management for HTTPS outcalls
/// 
/// NOT responsible for:
/// - Blockchain transactions (use EvmRpcClient)
/// - Smart contract interactions (use EvmRpcClient)
/// - Event monitoring (use 1inch API instead)
pub struct HttpClient;

impl HttpClient {

    pub async fn fetch_fusion_orders(
        api_key: Option<&str>,
        chain_id: u64,
    ) -> ResolverResult<Vec<OneInchOrder>> {
        let url = format!(
            "https://api.1inch.dev/fusion-plus/v1.0/{}/orders/all?status=active&limit=50",
            chain_id
        );

        let mut headers = vec![
            HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            },
            HttpHeader {
                name: "User-Agent".to_string(),
                value: "IC-Fusion-Resolver/1.0".to_string(),
            },
        ];

        // Add API key if provided
        if let Some(key) = api_key {
            headers.push(HttpHeader {
                name: "Authorization".to_string(),
                value: format!("Bearer {}", key),
            });
        }

        let request_body = "".as_bytes();
        let idempotency_key = ResolverUtils::generate_idempotency_key(request_body);
        
        headers.push(HttpHeader {
            name: "Idempotency-Key".to_string(),
            value: idempotency_key,
        });

        let cycles_needed = Self::calculate_api_cycles(url.len(), 100_000); // 100KB response estimate

        let request = CanisterHttpRequestArgument {
            url,
            method: HttpMethod::GET,
            body: None,
            max_response_bytes: Some(500_000), // 500KB max response
            transform: Some(TransformContext {
                function: TransformFunc(candid::Func {
                    principal: ic_cdk::api::id(),
                    method: "transform_oneinch_response".to_string(),
                }),
                context: vec![],
            }),
            headers,
        };

        match http_request(request, cycles_needed).await {
            Ok((response,)) => {
                let status = response.status.to_string().parse::<u32>().unwrap_or(0);
                if !(200..300).contains(&status) {
                    return Err(ResolverError::ExternalCallError(format!(
                        "1inch API error {}: {}",
                        response.status,
                        String::from_utf8_lossy(&response.body)
                    )));
                }

                let response_text = String::from_utf8(response.body)
                    .map_err(|e| ResolverError::ExternalCallError(format!("Invalid UTF-8 response: {}", e)))?;

                let orders: Vec<OneInchOrder> = serde_json::from_str(&response_text)
                    .map_err(|e| ResolverError::ExternalCallError(format!("JSON parse error: {}", e)))?;

                ic_cdk::println!("Successfully fetched {} 1inch orders", orders.len());
                Ok(orders)
            }
            Err((rejection_code, message)) => {
                Self::handle_http_error(rejection_code, message, cycles_needed)
            }
        }
    }

    /// Get quote from 1inch API for price estimation
    pub async fn get_quote(
        from_token: &str,
        to_token: &str,
        amount: &str,
        api_key: Option<&str>,
        chain_id: u64,
    ) -> ResolverResult<OneInchQuoteResponse> {
        let url = format!(
            "https://api.1inch.dev/swap/v6.0/{}/quote?src={}&dst={}&amount={}",
            chain_id, from_token, to_token, amount
        );

        let mut headers = vec![
            HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            },
            HttpHeader {
                name: "User-Agent".to_string(),
                value: "IC-Fusion-Resolver/1.0".to_string(),
            },
        ];

        if let Some(key) = api_key {
            headers.push(HttpHeader {
                name: "Authorization".to_string(),
                value: format!("Bearer {}", key),
            });
        }

        let request_body = "".as_bytes();
        let idempotency_key = ResolverUtils::generate_idempotency_key(request_body);
        
        headers.push(HttpHeader {
            name: "Idempotency-Key".to_string(),
            value: idempotency_key,
        });

        let cycles_needed = Self::calculate_api_cycles(url.len(), 10_000); // 10KB response estimate

        let request = CanisterHttpRequestArgument {
            url,
            method: HttpMethod::GET,
            body: None,
            max_response_bytes: Some(50_000), // 50KB max response
            transform: Some(TransformContext {
                function: TransformFunc(candid::Func {
                    principal: ic_cdk::api::id(),
                    method: "transform_oneinch_response".to_string(),
                }),
                context: vec![],
            }),
            headers,
        };

        match http_request(request, cycles_needed).await {
            Ok((response,)) => {
                let status = response.status.to_string().parse::<u32>().unwrap_or(0);
                if !(200..300).contains(&status) {
                    return Err(ResolverError::ExternalCallError(format!(
                        "1inch quote API error {}: {}",
                        response.status,
                        String::from_utf8_lossy(&response.body)
                    )));
                }

                let response_text = String::from_utf8(response.body)
                    .map_err(|e| ResolverError::ExternalCallError(format!("Invalid UTF-8 response: {}", e)))?;

                let quote: OneInchQuoteResponse = serde_json::from_str(&response_text)
                    .map_err(|e| ResolverError::ExternalCallError(format!("JSON parse error: {}", e)))?;

                Ok(quote)
            }
            Err((rejection_code, message)) => {
                Self::handle_http_error(rejection_code, message, cycles_needed)
            }
        }
    }

    /// Submit bid to 1inch auction (placeholder - actual implementation would be more complex)
    pub async fn submit_auction_bid(
        order_hash: &str,
        bid_amount: &str,
        api_key: Option<&str>,
        chain_id: u64,
    ) -> ResolverResult<bool> {
        // This is a placeholder - actual 1inch Fusion+ bidding happens on-chain
        // via their smart contracts, not HTTP API
        ic_cdk::println!("Would submit bid for order {} with amount {}", order_hash, bid_amount);
        Ok(false) // Return false for now as this needs on-chain implementation
    }

    
    fn calculate_api_cycles(request_size: usize, response_size: usize) -> u128 {
        let n = 13u128; // Number of consensus nodes
        let base_fee = (3_000_000 + 60_000 * n) * n;

        let request_fee = 400 * n * request_size as u128;
        let response_fee = 800 * n * response_size as u128;

        let total_calculated = base_fee + request_fee + response_fee;
        
        let with_buffer = (total_calculated as f64 * 3.0) as u128;

        with_buffer.max(5_000_000_000)
    }

    fn handle_http_error<T>(
        rejection_code: ic_cdk::api::call::RejectionCode,
        message: String,
        cycles_sent: u128,
    ) -> ResolverResult<T> {
        if message.contains("cycles") || message.contains("OutOfCycles") {
            Err(ResolverError::InsufficientCycles(format!(
                "Insufficient cycles: sent {} cycles but need more. Error: {}",
                cycles_sent, message
            )))
        } else if message.contains("SysTransient") || message.contains("timeout") {
            Err(ResolverError::NetworkError(format!(
                "Network error (consider retry): {:?} - {}",
                rejection_code, message
            )))
        } else {
            Err(ResolverError::ExternalCallError(format!(
                "HTTP request failed: {:?} - {}",
                rejection_code, message
            )))
        }
    }
}


#[query]
fn transform_oneinch_response(args: TransformArgs) -> HttpResponse {
    let mut response = args.response;

   
    response.headers.retain(|header| {
        let name_lower = header.name.to_lowercase();
        matches!(name_lower.as_str(), 
            "content-type" | 
            "content-length" |
            "content-encoding"
        )
    });

    if response.status != 200u16 {
        if let Ok(error_text) = String::from_utf8(response.body.clone()) {
            if error_text.contains("error") {
                let cleaned_error = error_text
                    .lines()
                    .filter(|line| !line.contains("timestamp") && !line.contains("request_id"))
                    .collect::<Vec<_>>()
                    .join("\n");
                response.body = cleaned_error.into_bytes();
            }
        }
    }

    response
}