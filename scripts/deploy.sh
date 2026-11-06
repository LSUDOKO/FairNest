#!/usr/bin/env bash
# Creates 5 faucet-funded testnet accounts, builds and deploys FairNest + tUSDC.
# Usage: PREFIX=yourname-fn ./scripts/deploy.sh
source "$(dirname "$0")/common.sh"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for acc in "$ESCROW" "$TOKEN" "$LANDLORD" "$TENANT" "$ARBITER"; do
  near account create-account sponsor-by-faucet-service "$acc" \
    autogenerate-new-keypair save-to-legacy-keychain "${NET[@]}" create
done

(cd "$ROOT/contract" && cargo near build non-reproducible-wasm)
(cd "$ROOT/test-token" && cargo near build non-reproducible-wasm)

near contract deploy "$ESCROW" use-file "$ROOT/contract/target/near/fairnest.wasm" \
  with-init-call new json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  "${NET[@]}" sign-with-legacy-keychain send
near contract deploy "$TOKEN" use-file "$ROOT/test-token/target/near/test_token.wasm" \
  with-init-call new json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  "${NET[@]}" sign-with-legacy-keychain send

# The escrow must be registered on the token to receive deposits.
call "$ESCROW" "$TOKEN" storage_deposit '{}' '0.01 NEAR'

echo
echo "Deployed. Put these in frontend/.env.local:"
echo "NEXT_PUBLIC_CONTRACT_ID=$ESCROW"
echo "NEXT_PUBLIC_TOKEN_ID=$TOKEN"
