# tests/

| Path | What |
| --- | --- |
| `onchain/verify.py` | 29 live checks against NEAR testnet (Python stdlib, no keys): `python3 tests/onchain/verify.py` |
| `api/vault.test.mjs` | 11 live NEP-413 vault API cases: `node --test tests/api/vault.test.mjs` |
| `results/` | saved output of every check (tests, clippy, builds, audits) |
| `../contract/tests/flows.rs` | the contract sandbox suite: `cd contract && cargo test -- --nocapture` |

What each check proves, the methodology and the latest results are in [TESTING.md](../TESTING.md).
