#!/bin/bash

# Test RPC calls for order ID: 0x0b859865ef5b5019ebc7b062a07153a648b75a7ac0167bd365ea8e4db8d5e5b9
ORDER_ID="0x0b859865ef5b5019ebc7b062a07153a648b75a7ac0167bd365ea8e4db8d5e5b9"
RESOLVER_ADDRESS="0x689b5A63B715a3bA57a900B58c74dA60F98F1370"
RPC_URL="https://node.ghostnet.etherlink.com"

echo "🔍 Testing RPC calls for Order ID: $ORDER_ID"
echo "================================================"

# 1. Test getOrderStatus
echo -e "\n1️⃣ Testing getOrderStatus..."
ENCODED_ORDER_HASH=$(echo $ORDER_ID | sed 's/0x//' | xargs printf "%064s\n" | tr ' ' '0')
GET_ORDER_STATUS_DATA="0x46423aa7${ENCODED_ORDER_HASH}"

echo "Encoded call data: $GET_ORDER_STATUS_DATA"

curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_call\",
    \"params\": [{
      \"to\": \"$RESOLVER_ADDRESS\",
      \"data\": \"$GET_ORDER_STATUS_DATA\"
    }, \"latest\"],
    \"id\": 1
  }" | jq .

echo -e "\n2️⃣ Testing getOrder..."
GET_ORDER_DATA="0xd9627aa4${ENCODED_ORDER_HASH}"

echo "Encoded call data: $GET_ORDER_DATA"

curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_call\",
    \"params\": [{
      \"to\": \"$RESOLVER_ADDRESS\",
      \"data\": \"$GET_ORDER_DATA\"
    }, \"latest\"],
    \"id\": 2
  }" | jq .

echo -e "\n3️⃣ Testing balanceOf calls..."
# From debug script: Maker escrow has USDT, Taker escrow has USDC
MAKER_ESCROW="0xcb1FCf33b83c30d0Cf5eEE1d0773D295DE771515"
TAKER_ESCROW="0xDAb7cD384489aCdD915A6Dfb682EeccDd06988c2"
USDT_ADDRESS="0xf7f007dc8Cb507e25e8b7dbDa600c07FdCF9A75B"
USDC_ADDRESS="0x4C2AA252BEe766D3399850569713b55178934849"

# Encode balanceOf for maker escrow
ENCODED_MAKER_ESCROW=$(echo $MAKER_ESCROW | sed 's/0x//' | xargs printf "%064s\n" | tr ' ' '0')
BALANCE_OF_MAKER="0x70a08231${ENCODED_MAKER_ESCROW}"

echo "Testing USDT balance in maker escrow:"
echo "Maker escrow: $MAKER_ESCROW"
echo "USDT address: $USDT_ADDRESS"
echo "Encoded call: $BALANCE_OF_MAKER"

curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_call\",
    \"params\": [{
      \"to\": \"$USDT_ADDRESS\",
      \"data\": \"$BALANCE_OF_MAKER\"
    }, \"latest\"],
    \"id\": 3
  }" | jq .

# Encode balanceOf for taker escrow  
ENCODED_TAKER_ESCROW=$(echo $TAKER_ESCROW | sed 's/0x//' | xargs printf "%064s\n" | tr ' ' '0')
BALANCE_OF_TAKER="0x70a08231${ENCODED_TAKER_ESCROW}"

echo -e "\nTesting USDC balance in taker escrow:"
echo "Taker escrow: $TAKER_ESCROW"
echo "USDC address: $USDC_ADDRESS" 
echo "Encoded call: $BALANCE_OF_TAKER"

curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_call\",
    \"params\": [{
      \"to\": \"$USDC_ADDRESS\",
      \"data\": \"$BALANCE_OF_TAKER\"
    }, \"latest\"],
    \"id\": 4
  }" | jq .

echo -e "\n✅ RPC testing completed"