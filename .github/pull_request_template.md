## What changes

## Why

## Checks
- [ ] `cd contract && cargo clippy --all-targets -- -D warnings && cargo test`
- [ ] `cd frontend && npm run lint && npx tsc --noEmit && npm run build`
- [ ] Contract change: new or updated test in `contract/tests/flows.rs`
- [ ] Changes who can move money or open the vault: SECURITY.md / AUDIT.md updated
- [ ] No keys, `.env` or `~/.near-credentials` content committed
