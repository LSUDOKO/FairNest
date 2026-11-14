# Contributing

Thanks for looking at FairNest. It moves other people's deposits, so changes are held to a simple rule:
**every change to who can move money or open the vault comes with a test that proves the new rule.**

## Setup

See [DEPLOYMENT.md](DEPLOYMENT.md#prerequisites) for the toolchain. Then:

```sh
cd contract && cargo test -- --nocapture        # sandbox flows
cd frontend && npm ci && npm run dev            # app on http://localhost:3000 (testnet)
python3 tests/onchain/verify.py                 # live deployment checks
```

## Before opening a pull request

- [ ] `cd contract && cargo clippy --all-targets -- -D warnings && cargo test`
- [ ] `cd frontend && npm run lint && npx tsc --noEmit && npm run build`
- [ ] Contract changes: a new or updated case in `contract/tests/flows.rs`
- [ ] Changes to roles, deadlines, payouts or the vault: update [SECURITY.md](SECURITY.md) and the API table in [API.md](API.md)
- [ ] State layout changes (`Lease`, collections): say so in the PR, because they need a fresh deploy, not an upgrade
- [ ] No keys, `.env` files or `~/.near-credentials` content

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same checks.

## Style

- Contract: keep inputs bounded (storage is a flat deposit), credit balances rather than sending funds in settlement paths, and make every callback `#[private]`.
- Prefer the standard library and existing dependencies over new ones.
- Commit messages: one line, imperative ("Add …", "Fix …").

## Security issues

Report them privately; see [SECURITY.md](SECURITY.md#reporting-a-vulnerability).
