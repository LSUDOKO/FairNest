#!/usr/bin/env bash
# One full dispute on testnet with 10-minute deadlines (unused: every step is answered at once).
# Usage: PREFIX=yourname-fn ./scripts/demo.sh   (after deploy.sh)
source "$(dirname "$0")/common.sh"
U=000000   # tUSDC has 6 decimals

# Lease "ended" a minute ago, so block time is past it even if the local clock runs ahead.
end=$(( $(date +%s) - 60 ))
ID=$(view "$ESCROW" lease_count '{}' | grep -o '"[0-9]*"' | tail -1 | tr -d '"')
echo "== 1. landlord creates a 1500 tUSDC lease that ends now"
call "$LANDLORD" "$ESCROW" create_lease "{\"tenant\":\"$TENANT\",\"arbiter\":\"$ARBITER\",\"token\":\"$TOKEN\",
  \"amount\":\"1500$U\",\"lease_end\":\"$end\",\"claim_window\":\"600\",\"response_window\":\"600\",\"arbiter_window\":\"600\",
  \"terms\":\"Demo: 12 months, 1 Main St, Apt 4\"}" '0.1 NEAR'
echo "lease id: $ID"

echo "== 2. tenant gets test tUSDC from the faucet and locks the deposit"
call "$TENANT" "$TOKEN" mint "{\"amount\":\"1500$U\"}"
call "$TENANT" "$TOKEN" ft_transfer_call "{\"receiver_id\":\"$ESCROW\",\"amount\":\"1500$U\",\"msg\":\"$ID\"}" '1 yoctoNEAR'

echo "== 3. landlord claims 200 (cleaning) + 400 (carpet)"
call "$LANDLORD" "$ESCROW" file_claim "{\"lease_id\":\"$ID\",\"lines\":[
  {\"reason\":\"Professional cleaning\",\"amount\":\"200$U\",\"evidence_url\":\"https://example.com/invoice.pdf\",\"evidence_sha256\":\"\"},
  {\"reason\":\"Carpet replacement\",\"amount\":\"400$U\",\"evidence_url\":\"https://example.com/carpet.jpg\",\"evidence_sha256\":\"\"}]}"

echo "== 4. tenant disputes the carpet: 200 to landlord and 900 to tenant are paid out now, 400 held"
call "$TENANT" "$ESCROW" dispute "{\"lease_id\":\"$ID\",\"lines\":[1],\"reason\":\"Carpet was 8 years old, normal wear\"}"

echo "== 5. arbiter awards 100 of the 400 to the landlord"
call "$ARBITER" "$ESCROW" resolve "{\"lease_id\":\"$ID\",\"to_landlord\":\"100$U\",\"note\":\"Depreciated value of an 8 year old carpet\"}"

echo "== 6. both withdraw"
call "$TENANT" "$ESCROW" withdraw "{\"token\":\"$TOKEN\"}"
call "$LANDLORD" "$TOKEN" storage_deposit '{}' '0.01 NEAR'
call "$LANDLORD" "$ESCROW" withdraw "{\"token\":\"$TOKEN\"}"

echo "== result"
view "$ESCROW" get_lease "{\"lease_id\":\"$ID\"}"
view "$TOKEN" ft_balance_of "{\"account_id\":\"$TENANT\"}"
view "$TOKEN" ft_balance_of "{\"account_id\":\"$LANDLORD\"}"
echo "Open https://testnet.nearblocks.io/address/$ESCROW to see every transaction."
