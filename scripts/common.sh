# Shared helpers. Keys live in ~/.near-credentials (legacy keychain), never in this repo.
set -euo pipefail
PREFIX="${PREFIX:?set PREFIX, e.g. PREFIX=fairnest-demo}"
ESCROW="$PREFIX-escrow.testnet"
TOKEN="$PREFIX-tusdc.testnet"
LANDLORD="$PREFIX-landlord.testnet"
TENANT="$PREFIX-tenant.testnet"
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
