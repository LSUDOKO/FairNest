# Tests and proof

Everything FairNest claims is checked by something in this list. Every check can be re-run, and the output
from the last run is saved in [`results/`](results/) (run on 2026-11-14 UTC, on Linux with Rust 1.97.1 and Node 24).

| # | What it proves | Run it | Last result |
| --- | --- | --- | --- |
| 1 | The full escrow and lease-NFT flows work end to end on a real NEAR node (local sandbox, no account needed) | `cd contract && cargo test -- --nocapture` | 6 sandbox tests + 1 unit test pass: [log](results/contract-sandbox-tests.log) |
| 2 | The live testnet deployment is in the state the README describes, all 9 demo transactions succeeded, the site is up, and the vault refuses an unsigned request | `python3 tests/onchain/verify.py` (Python 3 stdlib only, no keys) | 28 / 28 checks pass: [log](results/onchain-verify.log) |
| 3 | The code running at `fairnest-leases.testnet` is this repository's contract | `cd contract && cargo near build non-reproducible-wasm`, then check 5 of `verify.py` | Deployed `code_hash` `ER1avYfhbNf1wB6soD7vg6SedR5XMHx6giBviAgyFmku` equals base58(sha256) of the local `fairnest.wasm`: [log](results/onchain-verify.log) |
| 4 | Contract code lint | `cd contract && cargo clippy --all-targets` | 0 errors, 2 warnings, both doc-comment indentation (`clippy::doc_lazy_continuation`): [log](results/contract-clippy.log) |
| 5 | Both contracts build to wasm | `cargo near build non-reproducible-wasm` in `contract/` and `test-token/` | [contract](results/contract-build.log), [token](results/test-token-build.log) |
| 6 | Frontend lint, type check and production build | `cd frontend && npm run lint && npx tsc --noEmit && npm run build` | all exit 0: [eslint](results/frontend-eslint.log), [tsc](results/frontend-typecheck.log), [build](results/frontend-build.log) |
| 7 | Dependency advisories | `cd contract && cargo audit`, `cd frontend && npm audit --omit=dev` | see [`results/`](results/) and [AUDIT.md](../AUDIT.md) |
| 8 | Security review of both contracts | read [AUDIT.md](../AUDIT.md) | findings with severity and status |

## What the sandbox tests cover (`contract/tests/flows.rs`)

| Test | Scenario | Asserts |
| --- | --- | --- |
| `happy_path_native_near` | 5 NEAR deposit, 1.5 NEAR claim accepted | tenant withdraws 3.5 NEAR, landlord 1.5 |
| `partial_dispute_with_token_and_arbiter` | 1000 tUSDC, claim 100 + 300, tenant disputes the 300, arbiter awards 100 | 100 and 600 pay out at once; a withdraw to an unregistered account fails and the balance is restored; after `storage_deposit` it succeeds |
| `timeouts_protect_both_sides` | each of the three deadlines expires | silent landlord: full refund; silent tenant: claim stands; silent arbiter: disputed sum to tenant |
| `lease_nft_moves_the_deposit_and_every_tenant_right` | lease NFT hand-over | transfer without approval, by a non-holder, to an unapproved account, or without 1 yocto fails; approved hand-over works; the old tenant can no longer accept, dispute, pull the token back or withdraw; a transfer during a dispute (mid-payout) is rejected; the new holder is paid |
| `transfer_call_to_a_non_contract_returns_the_token` | `nft_transfer_call` to an account with no receiver | token returns to the sender |
| `guards_reject_bad_input` | wrong funder, wrong amount, wrong token, early claim, claim above deposit, windows above 365 days | all rejected, wrong token refunded |
| `amounts_read_like_money` (unit) | amount formatting in the NFT image | 6-decimal amounts print as whole tokens |

## Screenshots of the live app

Captured from https://fairnest.adoranto737.workers.dev while running lease #0 on testnet: [`docs/assets/screens/`](../docs/assets/screens/).
