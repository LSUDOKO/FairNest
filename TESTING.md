# Testing

Every FairNest claim is checked by something in this list. Each check can be re-run, and the output of the
last local run is saved in [`tests/results/`](tests/results/) (run on 2026-11-14 UTC, on Linux with Rust 1.97.1, cargo-near 0.23 and Node 22).
CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same checks on every push, and runs the
live checks daily.

## Methodology

| Layer | Framework | Runs against | Why this layer |
| --- | --- | --- | --- |
| Contract flows | `near-workspaces` 0.24 + tokio (`contract/tests/flows.rs`) | a local NEAR sandbox node running the compiled wasm | Real runtime semantics: receipts, promises, callbacks, storage staking, gas, time (blocks are fast-forwarded) |
| Contract unit | `cargo test` (`lib.rs` `mod tests`) | host | pure formatting helpers |
| Live chain | `tests/onchain/verify.py` (Python stdlib) | NEAR testnet archival RPC | proves the deployment, the demo transactions and the code hash, with no keys needed |
| Live API | `tests/api/vault.test.mjs` (`node:test`, `node:crypto`) | the deployed Worker | real NEP-413 signatures from the demo accounts, one case per auth rule |
| Static | `cargo clippy -D warnings`, ESLint, `tsc --noEmit` | source | lint and types |
| Supply chain | `cargo audit`, `npm audit --omit=dev` | lockfiles | known advisories |

No mocks: every contract test runs the real wasm, and the API tests hit the real Worker and chain.
No coverage percentage is reported, because none was measured.

## Results

| # | What it proves | Run it | Last result |
| --- | --- | --- | --- |
| 1 | Every escrow, NFT, deadline and authorization flow works on a real NEAR node | `cd contract && cargo test -- --nocapture` | 7 sandbox tests + 1 unit test pass: [log](tests/results/contract-sandbox-tests.log) |
| 2 | Testnet is in the documented state, all 9 demo transactions succeeded, the site is up, and the vault refuses unsigned requests | `python3 tests/onchain/verify.py` | 29 / 29: [log](tests/results/onchain-verify.log) |
| 3 | The deployed code is this repo | `cd contract && cargo near build non-reproducible-wasm`, then #2 | code hash `E6HYb4s46wqmXy2bMQ2pZP7uyZq58QddpWeTah3PhooN` matches: [log](tests/results/onchain-verify.log) |
| 4 | The vault gate holds for every rule | `node --test tests/api/vault.test.mjs` (signed cases need the demo keys in `~/.near-credentials/testnet`; otherwise they are skipped) | 11 / 11: [log](tests/results/vault-api-tests.log) |
| 5 | Contract lint | `cd contract && cargo clippy --all-targets -- -D warnings` | 0 warnings: [log](tests/results/contract-clippy.log) |
| 6 | Both contracts build | `cargo near build non-reproducible-wasm` in `contract/` and `test-token/` | [contract](tests/results/contract-build.log), [token](tests/results/test-token-build.log) |
| 7 | Frontend lint, types and build | `cd frontend && npm run lint && npx tsc --noEmit && npm run build` | exit 0: [eslint](tests/results/frontend-eslint.log), [tsc](tests/results/frontend-typecheck.log), [build](tests/results/frontend-build.log) |
| 8 | Dependencies | `cd contract && cargo audit`; `cd frontend && npm audit --omit=dev` | npm 0; cargo: 1 advisory in test-only `crypto-bigint`, not in the wasm: [cargo](tests/results/contract-cargo-audit.log), [npm](tests/results/frontend-npm-audit.log) |

## Contract tests (`contract/tests/flows.rs`)

| Test | Category | Asserts |
| --- | --- | --- |
| `happy_path_native_near` | normal execution | 5 NEAR deposit and a 1.5 NEAR claim accepted. The tenant withdraws 3.5 NEAR and their wallet balance rises. The status is `Settled` |
| `partial_dispute_with_token_and_arbiter` | NEP-141 integration, failure handling | 1000 tUSDC, a 100 + 300 claim, 300 disputed. 100 and 600 are credited at once and the arbiter awards 100. The landlord's withdraw while unregistered on the token **fails and the balance is restored**. After `storage_deposit` it succeeds |
| `timeouts_protect_both_sides` | state transitions, economic edge cases | Silent landlord: full refund. Silent tenant: the claim stands. Silent arbiter: the disputed sum goes to the tenant. **A late dispute, accept or ruling is rejected** (AUDIT F-2) |
| `lease_nft_moves_the_deposit_and_every_tenant_right` | NFT transfer security | Funding mints the token. These transfers fail: without approval, by a non-holder, to an unapproved account, without 1 yocto, and mid-payout (during a dispute). The approved hand-over works. The old tenant cannot accept, dispute, pull the token back or withdraw. The new holder is paid. The image reads "Closed" |
| `transfer_call_to_a_non_contract_returns_the_token` | unexpected external behaviour | `nft_transfer_call` to an account with no contract returns the token |
| `guards_reject_bad_input` | input validation, storage DoS | Rejected: wrong funder, wrong amount, wrong token (refunded), a claim before lease end, a claim above the deposit, a window over 365 days. **History stops at 16 events** (F-1). **`"05"` and `2^32+n` ids do not alias a lease** (F-5) |
| `unauthorized_callers_are_rejected` | access control, private callbacks, arithmetic | At every stage, each wrong role (tenant, arbiter, landlord, stranger) is refused for cancel, fund, release, approve, claim, accept, dispute and resolve. Out-of-range and empty line lists are rejected. A duplicate index counts once. An award above the disputed sum fails. **External calls to `on_withdraw` and `nft_resolve_transfer` fail** and mint nothing. An empty withdraw fails. **landlord + tenant = deposit exactly**. No second ruling or finalize |
| `amounts_read_like_money` (unit) | formatting | Token amounts in the NFT image print correctly |

Re-entrancy note: NEAR has no synchronous re-entrancy. The cross-receipt equivalent, a second `withdraw`
before the first transfer resolves, is prevented because the balance is removed before the promise is created
(see [AUDIT.md](AUDIT.md#properties-verified-correct)).

## Live API tests (`tests/api/vault.test.mjs`)

These read only: just `open` is called, plus one `add` that is rejected before anything is written.

| Case | Expected |
| --- | --- |
| no signature | 403 |
| current NFT holder `fairnest-tenant2` | 200, role `holder` |
| landlord | 200, role `landlord` |
| previous tenant who handed the NFT over | 403 "only the current lease NFT holder" |
| arbiter after the dispute closed | 403 |
| signature for another lease | 403 |
| signature for another app (recipient) | 403 |
| signature older than 10 minutes | 403 |
| tampered message | 403 "signature does not match" |
| another account's key claiming the holder's account | 403 "not a full-access key" |
| holder `add` with an empty entry | 400 (auth passed, nothing written) |

## Not tested

- **Frontend UI.** There are no automated browser tests. The flows were exercised by hand against testnet; see the [screenshots](docs/assets/screens/) and the [demo video](https://youtu.be/cMCJI5074Dw).
- **Fuzzing and property-based testing** of the contract.
- **Load testing** of the Worker.
