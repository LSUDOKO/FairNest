# Security

**Status: testnet prototype. FairNest has had an internal, AI-assisted security review and has automated
tests. It has not had an independent third-party audit.** Do not use it with real funds.

The detailed findings, evidence and fixes are in [AUDIT.md](AUDIT.md). This file covers the security model.

## Reporting a vulnerability

Please use GitHub's private reporting ([Security → Report a vulnerability](https://github.com/LSUDOKO/FairNest/security/advisories/new)),
not a public issue. Include the lease id or transaction hash if you have one.

## Assets being protected

| Asset | Where | Who must not be able to take it |
| --- | --- | --- |
| Deposits (NEAR and NEP-141) | contract account balance / token balance of `fairnest-leases.testnet` | anyone outside the lease rules, including the landlord, the arbiter and the developers |
| Credited payouts | `balances` map | anyone other than the credited account |
| The tenant role (NFT) | `lease.tenant` | a previous holder, a stranger, or an unapproved buyer |
| Inspection photos and notes | Cloudflare KV | anyone without a current role on the lease |
| Integrity of the record | `lease.history`, claim lines with sha256 | everyone: no edits after the fact |

## Trust assumptions

1. **The arbiter is chosen by the landlord** at creation and is visible to the tenant before funding. The arbiter can only split the *disputed* sum and only before the arbiter deadline. If the arbiter is silent, the tenant is favoured.
2. **The contract account key.** `fairnest-leases.testnet` still has a full-access key held by the developers (used to deploy the audit fixes). Whoever holds it can redeploy the code. This is the largest trust assumption on testnet; it is removed by deleting the key on mainnet ([AUDIT.md F-9](AUDIT.md)).
3. **The token contract.** For token leases, the landlord picks the token. A malicious token can fake funding of *its own* lease but cannot touch other tokens' balances ([F-7](AUDIT.md)). Mainnet plan: an allowlist.
4. **Evidence is off-chain.** The contract stores a link and a sha256. It proves the file was not swapped after the claim, but not that the photo is honest. Judging the photo is the arbiter's job.
5. **Vault storage (Cloudflare KV)** is trusted for availability and confidentiality at rest. Access decisions are taken from the chain, not from KV.
6. **RPC.** The vault Worker trusts a NEAR RPC endpoint (`rpc.testnet.fastnear.com`) for access-key and lease reads.

## Threat model and attack surfaces

| Surface | Threat | Mitigation | Evidence |
| --- | --- | --- | --- |
| Role checks on every method | Someone calls a method of another role | `predecessor_account_id` is compared with the lease's role on every change method | `unauthorized_callers_are_rejected` |
| Private callbacks | An attacker calls `on_withdraw` to mint themselves a balance, or `nft_resolve_transfer` to take a token | `#[private]` | same test |
| Async withdraw (re-entrancy across receipts) | Double withdraw, or a balance lost in a failed transfer | Balance removed before the promise; restored only on failure; each `withdraw` call reads a fresh balance | `partial_dispute_with_token_and_arbiter`; AUDIT.md "Properties verified" |
| `ft_on_transfer` | Fake token, wrong sender, wrong amount, replayed funding | Predecessor = lease token, sender = tenant, exact amount, `Created` only; any panic refunds | `guards_reject_bad_input` |
| Arithmetic | Overflow or underflow in sums, deadlines and splits | `checked_add` on claim totals, total ≤ deposit, award ≤ disputed, windows ≤ 365 d, lease end ≤ 10 y, `overflow-checks = true` | `guards_reject_bad_input`, `unauthorized_callers_are_rejected` (money conserved) |
| Deadlines | One side stalls forever, or races the other after a deadline | `finalize` by anyone; late `accept`/`dispute`/`resolve` rejected | `timeouts_protect_both_sides` |
| Storage DoS | Growing a record without paying for storage | Flat deposit, bounded inputs, history capped at 16 | `guards_reject_bad_input` (F-1) |
| NFT transfer | Old holder keeps rights; split payouts; pull-back | Live `lease.tenant` checks, transfer only while `Funded`, single-use landlord approval, 1 yocto, no NEP-178 approvals | `lease_nft_moves_the_deposit_and_every_tenant_right`, `transfer_call_to_a_non_contract_returns_the_token` |
| Vault API | Old holder, forged or replayed signature, limited key, another app's signature | NEP-413 check, recipient pinned, 10-minute expiry, FullAccess key only, live holder check | `tests/api/vault.test.mjs` (11 live cases) |
| Web app function-call key | A stolen browser key makes decisions without a wallet popup | The key is limited to this contract, 9 methods and a 0.25 NEAR gas allowance. It cannot fund, transfer the NFT or withdraw to another account | [F-4](AUDIT.md), accepted risk |
| Front-running | A landlord races a dispute with `release_full`, or the arbiter races `finalize` | No incentive (release only helps the tenant); deadline checks make the race impossible after F-2 | `timeouts_protect_both_sides` |

Not applicable: price oracles (there are none), and AMM or MEV extraction (no trading).

## Methodology and tools

| Kind | What was done | Result |
| --- | --- | --- |
| Manual code review (AI-assisted, internal) | Every public method of `lib.rs` and `nft.rs` read against a checklist: storage, callbacks, re-entrancy, access control, arithmetic, state machine, NFT standard, centralisation, gas | 10 findings: [AUDIT.md](AUDIT.md) |
| Automated tests | near-workspaces sandbox (real NEAR runtime), 7 flows + 1 unit test | [results](tests/results/contract-sandbox-tests.log) |
| Live tests | `verify.py` (29 on-chain checks), `vault.test.mjs` (11 signed API cases) | [results](tests/results/) |
| Static analysis | `cargo clippy --all-targets -D warnings` | 0 warnings |
| Dependency scanning | `cargo audit` (RustSec), `npm audit --omit=dev` | 1 advisory in test-only tooling, not in the wasm; npm 0 |
| CI | All of the above on every push, and daily against testnet | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

## Fixed

F-1 (unpaid history growth), F-2 (late answers after deadlines) and F-5 (id aliasing) were fixed, covered by
regression tests, and deployed to testnet in tx
[`8kRsYp4A…`](https://testnet.nearblocks.io/txns/8kRsYp4AUcnV7reboLz3FUhF29PG4zcbWJenbWbTgP7d).

## Remaining risks and limitations

- **No external audit.** Coverage is limited to the scenarios in the tests.
- **F-3: a minimum window of 1 s.** A landlord can choose an unfairly short response window. It is visible before funding.
- **F-4: no 1-yocto confirmation** on `accept`, `release_full` or `resolve`.
- **F-6: unbounded views and index padding** by third parties.
- **F-7: no token allowlist.**
- **F-8: non-standard handling** of a non-bool `nft_on_transfer` reply.
- **F-10: the successor's consent** is not recorded on-chain.
- **The developer-held contract key** (see trust assumption 2).
- **Vault signature replay** is possible within 10 minutes, but only for the same lease and only while the signer still has a role.
- **The testnet stablecoin has an open faucet.** tUSDC has no value.
