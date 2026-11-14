# FairNest: guide for judges

This file maps every FairNest claim to something you can run or open. It follows the organizers' screening
steps (HACKATHON.md Q-017): reproducibility check, feature verification, structured report.

## 1. Reproduce (about 2 minutes, no accounts)

| Do | See |
| --- | --- |
| `python3 tests/onchain/verify.py` | `ALL CHECKS PASSED`. There are 29 checks against NEAR testnet: lease 0 state, NFT owner, all 9 demo transactions, the live site, the vault refusing unsigned requests, and the deployed code hash equal to the local build (that last check needs step 2's build). [Saved output](tests/results/onchain-verify.log). |
| Open https://fairnest.adoranto737.workers.dev/lease?id=0 | Lease #0 `Settled`, holder `fairnest-tenant2.testnet`, the 300 / 1200 split bar, the holder timeline, and the on-chain record. No wallet needed. |
| `cd contract && cargo test -- --nocapture` (needs Rust + cargo-near, about 5 min the first time) | `6 passed` sandbox flows + `1 passed` unit test, each printing its steps. [Saved output](tests/results/contract-sandbox-tests.log). |
| `cd frontend && npm install && npm run lint && npm run build` | Both exit 0, and 7 static routes are built. [eslint](tests/results/frontend-eslint.log), [build](tests/results/frontend-build.log). |

Every check, with its command and last result, is listed in [tests/README.md](tests/README.md).

## 2. Feature verification: claim, then proof

| Claim | Code | Test | On-chain / live |
| --- | --- | --- | --- |
| The deposit is held by the contract, not a party | `lib.rs` `fund_native`, `ft_on_transfer` | all sandbox flows | tx [A6iguWyA…](https://testnet.nearblocks.io/txns/A6iguWyAXeFebXhnSZ6Gz5NQLdQUZ1Kdt5XqUKFEapd8) moves 1500 tUSDC into `fairnest-leases.testnet` |
| Deductions are itemised with evidence (link + sha256) | `lib.rs` `file_claim`, `Line` | `partial_dispute_with_token_and_arbiter` | lease 0 `claim` has 2 lines; `verify.py` §1 |
| The tenant disputes single lines, and the undisputed part pays at once | `lib.rs` `dispute` | `partial_dispute_with_token_and_arbiter` (100 and 600 paid before the ruling) | tx [FUdqxMTE…](https://testnet.nearblocks.io/txns/FUdqxMTEpmHFUk6zvsNyGiNWVD2QQRUtfgfXBdkyuE1Q) |
| The arbiter can only split the disputed sum | `lib.rs` `resolve`, the `to_landlord <= disputed` check | `partial_dispute_with_token_and_arbiter` | tx [6R1YjfpT…](https://testnet.nearblocks.io/txns/6R1YjfpTe1YaB13kCtrtJi2aspaqnHKmK2gia2gGW5Za); 300 + 1200 = 1500 asserted in `verify.py` |
| Nobody can stall: three deadlines, each applied by anyone | `lib.rs` `finalize` | `timeouts_protect_both_sides` (all three, plus late answers rejected) | the app shows "Apply the passed deadline" |
| Payouts cannot get lost in a failed transfer | `lib.rs` `withdraw`, `on_withdraw` (`#[private]`) | `partial_dispute_with_token_and_arbiter` (unregistered receiver, balance restored) | txs [Ce7GGLH1…](https://testnet.nearblocks.io/txns/Ce7GGLH15pFVwG1p1gszziDyX4agyktjvXvUYW7gGX5u), [HPxB6rfb…](https://testnet.nearblocks.io/txns/HPxB6rfbtj9d3cTk8y1ACx5TzH8aM7gemGD2Bw6E89YR) |
| The lease is an NEP-171 NFT, and the holder *is* the tenant | `nft.rs` (`owner_id` = `lease.tenant`) | `lease_nft_moves_the_deposit_and_every_tenant_right` | `nft_token("0").owner_id = fairnest-tenant2.testnet`; `verify.py` §2 |
| The NFT moves only to a landlord-approved replacement, and only while Funded | `nft.rs` `transfer` | same test: unapproved, non-holder, no-yocto and mid-payout transfers all fail | txs [GJdf6DsZ…](https://testnet.nearblocks.io/txns/GJdf6DsZHdbbAiwn7aVFKR6JFyMLQSxk79HfZqhH5zRs), [C6U749WD…](https://testnet.nearblocks.io/txns/C6U749WD8ghsMqsVJSf2A4hFANCiCXiu3M76QK8qqYwB) |
| The old holder loses every right | live `lease.tenant` checks | same test: the old tenant cannot accept, dispute, pull back or withdraw | `nft_tokens_for_owner(fairnest-tenant)` no longer lists token 0; `verify.py` §2 |
| The NFT image is drawn on-chain from the live lease stage | `nft.rs` `token()` | `amounts_read_like_money` (unit) | `nft_token("0").metadata.media` is `data:image/svg+xml…` |
| The gated vault opens only for the current holder, the landlord, or the arbiter during a dispute | `frontend/worker/index.ts` `authorize` (NEP-413 + `view_access_key` FullAccess + `get_lease`) | n/a | an unsigned request gets 403 (`verify.py` §4); as the old tenant, "Access denied" ([screenshot](docs/assets/screens/06-vault-access-denied.jpg)) |
| History per NFT, and a non-transferable clean-move-out badge | `frontend/src/app/lease`, `frontend/src/app/profile` | n/a | [`/lease?id=0`](https://fairnest.adoranto737.workers.dev/lease?id=0), [`/profile?account=fairnest-tenant2.testnet`](https://fairnest.adoranto737.workers.dev/profile?account=fairnest-tenant2.testnet) |
| The deployed contract is this source | `contract/` | `cargo near build non-reproducible-wasm` | `verify.py` §5: code hash `E6HYb4s4…` equals the local wasm |
| Security reviewed | [AUDIT.md](AUDIT.md) | regression tests for F-1, F-2 and F-5 in `flows.rs` | fixes deployed in tx [8kRsYp4A…](https://testnet.nearblocks.io/txns/8kRsYp4AUcnV7reboLz3FUhF29PG4zcbWJenbWbTgP7d) |

## 3. Track fit

### `nfts`: NFTs That Do Something. These are the track brief's requirements.

| Brief requirement | FairNest |
| --- | --- |
| An NEP-171 contract plus the logic that ties each token to what it controls | The token *is* the lease record. The deposit, the refund right, the right to answer claims, and vault access all key off `nft_token(id).owner_id`. ([README: The lease NFT](README.md#the-lease-nft-track-nfts)) |
| A README explaining how control passes on transfer and what stops the old owner keeping access | README "How control passes on transfer" and a 10-row threat-model table |
| A gated page only current holders can open | `/vault?id=N`: NEP-413 signature, full-access key, holder read from chain on every request |
| A history view per NFT: earned, paid out, who held it | The lease page holder timeline and payouts; `/profile` record and badges |
| Tests for the transfer path, including a sale in the middle of a payout | `lease_nft_moves_the_deposit_and_every_tenant_right` (mid-dispute transfer rejected), `transfer_call_to_a_non_contract_returns_the_token` |
| A threat model for the transfer, written first | README threat-model table, plus AUDIT.md |

### `realworld`: Real-World Money

- Deposits are in a 6-decimal stablecoin (NEP-141 `ft_transfer_call`; tUSDC on testnet, because there is no official testnet USDC) or native NEAR.
- The "CSV for your records" export on every lease covers the timeline, the claim lines and the final split.
- Status a party can trust: every step links to its transaction.
- Not built: a 1Click / Intents pay-in, and a gasless relayer. Both are listed honestly in README "Not built". Routine calls already avoid wallet popups through a scoped function-call key.

### `open`

The release rules live in a contract anyone can read, the testnet demo uses minute-scale timers, and the README has a failure-case section.

## 4. What is different, by mechanism

- **The deposit, not a receipt, is the NFT.** There is no separate ownership map that could drift from the money. One field, `lease.tenant`, decides who is paid, who answers claims and who opens the vault, and the NFT standard reads the same field.
- **Line-level disputes with partial settlement.** Undisputed lines and the unclaimed remainder pay out in the same transaction as the dispute, so the arbiter only ever holds the contested amount.
- **Default outcomes that favour the party who acted.** A silent landlord means a refund. A silent tenant means the claim stands. A silent arbiter means the money goes to the tenant, because the landlord carries the burden of proof. Anyone can apply a deadline.
- **Off-chain privacy, on-chain authority.** Inspection photos stay off-chain, but who may see them is decided by the chain on every request (NEP-413 plus the live holder).

## 5. Honest limits

- **Testnet only.** The contract account still has a full-access key; deleting it is the mainnet step ([AUDIT.md F-9](AUDIT.md)).
- **Open findings.** F-3 (minimum window length), F-4 (no 1-yocto on irreversible calls), F-6 (unbounded views) and F-7 (token allowlist) are acknowledged and not fixed.
- **Not built.** A Sputnik DAO arbiter, NEAR Intents pay-in, a meta-transaction relayer, deposit interest, and paying the outgoing tenant inside the NFT transfer.
- **Tooling.** The code was written during the hackathon with help from an AI coding assistant. The security review in AUDIT.md is internal and AI-assisted, not a third-party audit.

## 6. Links

| | |
| --- | --- |
| Repository | https://github.com/LSUDOKO/FairNest |
| Live app | https://fairnest.adoranto737.workers.dev |
| Contract | https://testnet.nearblocks.io/address/fairnest-leases.testnet |
| Release with the deployed wasm, ABI and checksums | https://github.com/LSUDOKO/FairNest/releases |
| Demo video story | [video/STORY.md](video/STORY.md) |
