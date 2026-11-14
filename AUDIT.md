# FairNest contract security review

**What this is:** an internal review done during the hackathon with AI assistance. A model read every
public method of the two contracts independently, without the authors' notes. The authors then checked each
finding against the code and fixed what could be fixed safely before the deadline. **It is not a
third-party audit.** Do not put real money in this contract on mainnet until an independent auditor has
reviewed it.

| | |
| --- | --- |
| Scope | `contract/src/lib.rs` (escrow), `contract/src/nft.rs` (NEP-171/177/181 lease NFT); `test-token/` skimmed |
| Commit reviewed | `1082229` (the version deployed on 2026-11-13, code hash `ER1avYfh…`) |
| Fixes deployed | to `fairnest-leases.testnet` on 2026-11-14 in tx [`8kRsYp4A…`](https://testnet.nearblocks.io/txns/8kRsYp4AUcnV7reboLz3FUhF29PG4zcbWJenbWbTgP7d). The new code hash is `E6HYb4s46wqmXy2bMQ2pZP7uyZq58QddpWeTah3PhooN`, and `tests/onchain/verify.py` checks it equals the wasm built from this repo. The storage layout is unchanged, so the settled demo lease 0 and its transaction links still work. |
| Method | manual line-by-line read; near-sdk 5.30 macro codegen checked for callback behaviour; sandbox regression tests for every fixed finding; `cargo clippy -D warnings`; `cargo audit`; `npm audit` |

## Summary

| ID | Severity | Title | Status |
| --- | --- | --- | --- |
| F-1 | High | `approve_successor` could grow a lease's history without paying for storage | **Fixed** (cap) and tested |
| F-2 | Medium | Late `accept` / `dispute` / `resolve` could race `finalize` after a deadline | **Fixed** and tested |
| F-3 | Medium | Landlord can choose a 1-second response window | Acknowledged: needed for the testnet demo; mainnet minimum planned |
| F-4 | Low | Irreversible decisions do not require 1 yoctoNEAR (wallet confirmation) | Acknowledged: a deliberate UX trade-off |
| F-5 | Low | Lease / token id aliasing (`"05"`, `2^32 + n`) | **Fixed** and tested |
| F-6 | Low | Per-account index and some views are unbounded | Acknowledged |
| F-7 | Low | Landlord-chosen token can fake a "funded" NFT | Acknowledged: allowlist planned |
| F-8 | Info | `nft_resolve_transfer` panics on a non-bool receiver reply | Acknowledged |
| F-9 | Info | Centralisation: the contract account still has a full-access key | Acknowledged: delete before mainnet |
| F-10 | Info | The approved successor does not have to accept the hand-over | Acknowledged |

No finding lets anyone take another party's deposit. F-1 could **freeze** native-NEAR withdrawals, but not
steal them. It was fixed and redeployed.

## Findings

### F-1 (High): unpaid history growth through `approve_successor`. Fixed.

`approve_successor` takes no deposit, and each call appended an event (about 100–170 bytes) to
`lease.history`. Toggling between `Some(x)` and `None` could repeat forever. The flat 0.1 NEAR storage
deposit paid at `create_lease` only covers the record as created.

*Exploit (before the fix).* An attacker controls a landlord, a tenant and an arbiter account. They create a
1-yocto native lease, fund it, then loop `approve_successor`. Storage staking for the growing record comes
out of the contract's balance, and that balance also holds every tenant's native-NEAR deposit. Once storage
cost exceeds the free balance, any native `withdraw` fails with `LackBalanceForState`, so funds are frozen
until someone tops the account up. A very large record could also exceed gas when loaded, freezing that
lease.

*Fix.* `approve_successor` now requires `lease.history.len() < MAX_HISTORY` (16):
[`lib.rs:38`](contract/src/lib.rs#L38), [`lib.rs:231`](contract/src/lib.rs#L231). Every hand-over needs a
fresh single-use approval, so transfers and `transfer_returned` events are bounded by the same cap. The
largest a lease can now get is about 16 events plus 10 claim lines.

*Test.* `guards_reject_bad_input` checks that exactly 14 approvals succeed on a funded lease (created +
funded + 14 = 16) and that the 15th fails.

*Residual.* A worst-case record (10 lines of 300-byte text, 16 events, 300-byte notes) is close to the
10 KB that 0.1 NEAR pays for. Any shortfall comes from the contract account's own float (several NEAR),
not from deposits. Metering with `env::storage_usage()` is the mainnet fix.

### F-2 (Medium): deadlines were only enforced through `finalize`. Fixed.

`file_claim` checked its window, but `accept`, `dispute` and `resolve` did not. After the arbiter window
passed, the README rule is "disputed sum goes to the tenant", yet the arbiter could still call
`resolve(to_landlord = all)` if they got in before anyone called `finalize`. Likewise, a tenant could
dispute after the response window.

*Fix.* `accept` and `dispute` require `now <= stage_at + response_window`
([`lib.rs:308`](contract/src/lib.rs#L308), [`lib.rs:321`](contract/src/lib.rs#L321)), and `resolve`
requires `now <= stage_at + arbiter_window` ([`lib.rs:355`](contract/src/lib.rs#L355)). `finalize`
uses the strict `>`, so exactly one of the two paths is open at any moment.

*Test.* `timeouts_protect_both_sides` checks a late `dispute`, a late `accept` and a late `resolve`, and
each is rejected.

### F-3 (Medium): minimum window is 1 second. Acknowledged.

A landlord could create a lease with `response_window = 1`, file a full claim and `finalize` it before the
tenant reacts. The tenant has to fund the lease first, so the terms are visible on the lease page
beforehand. The live demo relies on 2–10 minute windows so judges can see deadlines expire. Mainnet plan:
a minimum of 3 days for the response and arbiter windows, and a UI warning before funding.

### F-4 (Low): no 1-yocto confirmation on `cancel`, `release_full`, `file_claim`, `accept`, `dispute`, `resolve`. Acknowledged.

These methods can be called with the app's function-call access key, which is a deliberate choice so that
claims and rulings need no wallet popup. A stolen browser key could therefore accept a claim or release a
deposit. It cannot withdraw to another account: `withdraw` only pays the caller, and NFT transfers do
require 1 yocto. Mainnet plan: require 1 yocto on `accept`, `release_full` and `resolve`.

### F-5 (Low): id aliasing. Fixed.

`id as u32` meant lease `2^32 + 5` read lease 5, and `"05"` parsed as token 5. Indexers would then record
a move of the wrong token id. No funds were at risk. Lookups now use `u32::try_from`
([`lib.rs:453`](contract/src/lib.rs#L453), [`lib.rs:475`](contract/src/lib.rs#L475)), and token ids must be
canonical ([`nft.rs:68`](contract/src/nft.rs#L68)). Tested in `guards_reject_bad_input`.

### F-6 (Low): unbounded index and views. Acknowledged.

Anyone can create leases that name a victim as tenant or arbiter, at 0.1 NEAR each, which pads the victim's
`by_account` list and slows `get_leases_for` and `nft_tokens_for_owner`. `nft_tokens` scans every lease
from 0. These are views, so they are gas-limited and not dangerous, only slower. Fix: a per-account
`IterableSet`, pagination before loading, and a separate minted-id index.

### F-7 (Low): fake funding with a landlord-chosen token. Acknowledged.

A landlord can name their own "token" contract, which calls `ft_on_transfer` as if the tenant paid. The
lease turns Funded and the NFT reads "1,000,000 USDC" with no real money behind it. Balances are kept per
`(account, token)`, so no real funds are affected, but the NFT image could mislead a buyer. Fix: a token
allowlist (USDC) and showing the token account in the metadata.

### F-8 (Info): `nft_resolve_transfer` and a non-bool receiver reply. Acknowledged.

If the receiver's `nft_on_transfer` returns something that is not a bool, the callback panics and the token
stays with the receiver. The NEP-171 reference instead returns the token. There is no exploit, because the
receiver could equally return `false`.

### F-9 (Info): centralisation. Acknowledged.

The contract has no owner, admin, pause or migrate method. However, `fairnest-leases.testnet` still has one
full-access key (`ed25519:C9nvfSc…`), which the authors used for the redeploy above. Whoever holds that key
can replace the code. **So on testnet, "nobody can move a deposit outside the rules" holds only if you
trust the key holder not to redeploy.** Mainnet plan: deploy, verify the code hash, then delete the
full-access key (or move upgrades behind a DAO vote), so the code is final.

### F-10 (Info): hand-over without receiver consent. Acknowledged.

`nft_transfer` gives the approved successor the tenant role, including the duty to answer claims, without
the successor having to act. In practice the landlord approves someone who asked to take over the lease.
Fix: a `accept_handover` step by the successor.

## Properties verified correct

- **Callbacks are private.** `on_withdraw` ([`lib.rs:434`](contract/src/lib.rs#L434)) and
  `nft_resolve_transfer` ([`nft.rs:128`](contract/src/nft.rs#L128)) are `#[private]`.
- **No double withdraw.** `withdraw` ([`lib.rs:412`](contract/src/lib.rs#L412)) removes the balance before
  creating the promise. A second call in the async gap sees 0, and `on_withdraw` restores the balance on
  any failure: a native transfer to a deleted account, or a failed or out-of-gas `ft_transfer`. This is
  tested with an unregistered receiver in `partial_dispute_with_token_and_arbiter`.
- **`ft_on_transfer`** ([`lib.rs:287`](contract/src/lib.rs#L287)) checks that the predecessor is the
  lease's token, the sender is the tenant, the amount is exact and the status is `Created`. Any panic makes
  the token contract refund the full amount (tested with a wrong token).
- **Money is conserved.** Every terminal path credits exactly `amount` in total. `file_claim` sums with
  `checked_add` and requires total ≤ deposit ([`lib.rs:262`](contract/src/lib.rs#L262)), so the
  subtractions in `dispute` cannot underflow. `resolve` caps the award at the disputed sum
  ([`lib.rs:357`](contract/src/lib.rs#L357)). `overflow-checks = true` is on in release. Lease 0 on
  testnet shows 300 + 1200 = 1500, and `verify.py` asserts it.
- **Nobody can stall.** Each non-terminal state has a `finalize` path that anyone can call, and every
  deadline is capped at 365 days (lease end at 10 years).
- **The NFT cannot be duplicated or kept.** Ownership is the single field `lease.tenant`. Transfers need
  1 yocto ([`nft.rs:84`](contract/src/nft.rs#L84), [`nft.rs:99`](contract/src/nft.rs#L99)), the current
  holder, `Funded` status and the landlord-approved successor
  ([`nft.rs:222`](contract/src/nft.rs#L222)). The approval is single-use, and NEP-178 approvals are
  rejected. `nft_resolve_transfer` only returns the token if the receiver still holds it and the lease is
  still `Funded` ([`nft.rs:141`](contract/src/nft.rs#L141)).
- **Access control.** Every state-changing method checks its role (landlord, tenant / NFT holder, arbiter,
  or anyone for `finalize`), and the arbiter must be distinct from both parties.

## Dependencies

`cargo audit` ([log](tests/results/contract-cargo-audit.log)) on 465 crates in `Cargo.lock`:

- **RUSTSEC-2026-0387** (`crypto-bigint` 0.5.5, timing variability). Reached only through the test-only
  `near-workspaces` / sandbox tooling. `cargo tree -e normal --target wasm32-unknown-unknown -i crypto-bigint`
  prints nothing, so it is **not in the deployed wasm**.
- RUSTSEC-2022-0054 (`wee_alloc` unmaintained). This is near-sdk's allocator, so it is in the wasm. It is
  a maintenance warning, not a vulnerability.
- RUSTSEC-2024-0449 (`unsafe-libyaml` unmaintained). Test tooling only.

`npm audit --omit=dev` on the frontend reports 0 vulnerabilities ([log](tests/results/frontend-npm-audit.log)).

## Off-chain vault (`frontend/worker/index.ts`)

The vault Worker verifies a NEP-413 signature with a 32-byte nonce, a fixed recipient and a 10-minute
expiry. It checks with `view_access_key` that the key is a **full-access** key of the account, and reads the
current NFT holder from the chain on every request. `verify.py` checks that an unsigned request gets 403.
The nonce is not stored, so a captured signature can be replayed within its 10-minute window. A replay only
works for the same lease, and only while the signer still has a role on it, because the role is read
from the chain again each time. A tenant who has handed over the NFT gets 403 even with a fresh signature.
