# Shared helpers. Keys live in ~/.near-credentials (legacy keychain), never in this repo.
set -euo pipefail
PREFIX="${PREFIX:?set PREFIX, e.g. PREFIX=fairnest-demo}"
ESCROW="${ESCROW:-$PREFIX-escrow.testnet}"
TOKEN="$PREFIX-tusdc.testnet"
LANDLORD="$PREFIX-landlord.testnet"
TENANT="$PREFIX-tenant.testnet"
NEXT_TENANT="$PREFIX-tenant2.testnet"   # replacement tenant who takes over the lease NFT
ARBITER="$PREFIX-arbiter.testnet"
NET=(network-config testnet)

# call <signer> <contract> <method> <json> [deposit]
call() {
  near contract call-function as-transaction "$2" "$3" json-args "$4" \
    prepaid-gas '100.0 Tgas' attached-deposit "${5:-0 NEAR}" \
    sign-as "$1" "${NET[@]}" sign-with-legacy-keychain send
}
view() {
  near contract call-function as-read-only "$1" "$2" json-args "$3" "${NET[@]}" now
}

# exists <account>: true if the testnet account already exists
exists() {
  curl -s https://rpc.testnet.near.org -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$1\"}}" |
    grep -q '"amount"'
}
