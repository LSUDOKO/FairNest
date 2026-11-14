# API

Two interfaces: the NEAR contract (`fairnest-leases.testnet`) and the vault HTTP API on the Worker.
All amounts are strings in the token's smallest unit (yoctoNEAR, or 6-decimal tUSDC units). Ids are strings (`U64`).
The machine-readable ABI is attached to the [v1.0.0 release](https://github.com/LSUDOKO/FairNest/releases/tag/v1.0.0) (`fairnest_abi.json`).

## Contract: change methods

| Method | Caller | Deposit | Args | Effect / guards |
| --- | --- | --- | --- | --- |
| `create_lease` | landlord | ≥ 0.1 NEAR | `tenant, arbiter, token: AccountId \| null, amount, lease_end (unix s), claim_window, response_window, arbiter_window (s), terms` | Returns the lease id. Tenant ≠ landlord; arbiter differs from both; each window is 1 s to 365 days; lease end is within 10 years; text ≤ 300 bytes |
| `cancel` | landlord | – | `lease_id` | `Created` → `Cancelled` |
| `fund_native` | tenant | exactly `amount` | `lease_id` | Native-NEAR leases only. `Created` → `Funded`, NFT minted |
| `ft_on_transfer` | token contract | – | via `ft_transfer_call(receiver_id = contract, amount, msg = "<lease_id>")` | Predecessor must be the lease token, sender the tenant, amount exact; otherwise refunded |
| `release_full` | landlord | – | `lease_id` | `Funded` → `Settled`, full refund credited |
| `approve_successor` | landlord | – | `lease_id, successor: AccountId \| null` | `Funded` only. Successor must be a new account. Allowed while the history has < 16 events |
| `file_claim` | landlord | – | `lease_id, lines: [{reason, amount, evidence_url, evidence_sha256}]` | After `lease_end`, within `claim_window`. ≤ 10 lines, total ≤ deposit. `Funded` → `Claimed`; clears any successor |
| `accept` | NFT holder | – | `lease_id` | Within `response_window`. `Claimed` → `Settled` |
| `dispute` | NFT holder | – | `lease_id, lines: [u32], reason` | Within `response_window`. Undisputed lines and remainder credited now. `Claimed` → `Disputed` |
| `resolve` | arbiter | – | `lease_id, to_landlord, note` | Within `arbiter_window`. `to_landlord ≤ disputed sum`. `Disputed` → `Settled` |
| `finalize` | anyone | – | `lease_id` | Applies the expired deadline: Funded → full refund; Claimed → claim stands; Disputed → disputed sum to tenant |
| `withdraw` | anyone with a balance | – | `token: AccountId \| null` | Sends the credited balance; restored if the transfer fails. Reserves 10 Tgas for `ft_transfer` and 10 Tgas for the callback (the app attaches 30 Tgas) |
| `nft_transfer` | NFT holder | 1 yocto | `receiver_id, token_id, approval_id: null, memo` | `Funded` only, receiver = approved successor. Moves the tenant role |
| `nft_transfer_call` | NFT holder | 1 yocto | `+ msg` | As above, then `nft_on_transfer` on the receiver; token returned if the receiver says so and the lease is still `Funded` |

Private callbacks (reject external callers): `on_withdraw`, `nft_resolve_transfer`.

## Contract: views

| Method | Args | Returns |
| --- | --- | --- |
| `get_lease` | `lease_id` | `Lease \| null`: parties, token, amount, windows, `status`, `claim`, `disputed`, `stage_at`, `to_landlord`, `to_tenant`, `history[] {kind, actor, ts, note}`, `successor` |
| `get_leases_for` | `account_id` | every lease the account took part in |
| `get_balance` | `account_id, token` | credited, not yet withdrawn |
| `lease_count` | – | number of leases |
| `nft_token` | `token_id` | NEP-171 `Token` (owner = current tenant; `metadata.media` = on-chain SVG) or null |
| `nft_metadata` | – | NEP-177 contract metadata (`spec: nft-1.0.0`) |
| `nft_total_supply`, `nft_tokens`, `nft_supply_for_owner`, `nft_tokens_for_owner` | NEP-181 | enumeration of funded leases |

Status values: `Created`, `Funded`, `Claimed`, `Disputed`, `Settled`, `Cancelled`.

## Contract: events (NEP-297)

Every state change logs `EVENT_JSON:{"standard":"fairnest","version":"1.0.0","event":"<kind>","data":[{"lease_id","actor","note"}]}`.
The kinds are `created, cancelled, funded, successor_approved, transferred, transfer_returned, claimed, accepted, disputed, resolved, released, timeout_no_claim, timeout_claim_stands, timeout_arbiter_silent`.
The NFT side also emits the standard `nft_mint` and `nft_transfer` events (`"standard":"nep171"`).

Example, as read from testnet:

```sh
near contract call-function as-read-only fairnest-leases.testnet get_lease json-args '{"lease_id":"0"}' network-config testnet now
```

## Vault HTTP API

Base URL: `https://fairnest.adoranto737.workers.dev`

### `POST /api/vault/:leaseId/open`

```json
{ "auth": { "accountId": "alice.testnet", "publicKey": "ed25519:…", "signature": "<base64 or ed25519:base58>",
            "message": "Open the FairNest vault for lease 0 at 1794591305000",
            "nonce": "<base64 of 32 bytes>", "recipient": "fairnest-vault" } }
```

The `auth` object is what `wallet.signMessage({ message, recipient: "fairnest-vault", nonce })` returns, plus the message fields.
The response is `200 { "role": "holder" | "landlord" | "arbiter", "items": [{ author, role, ts, kind, text, image? }] }`.

### `POST /api/vault/:leaseId/add`

The body is the same `auth`, plus `kind: "move-in" | "move-out" | "note"`, `text` (≤ 2000 characters) and an optional `image` (a `data:image/(jpeg|png|webp);base64,…` URL of 1.4 M characters or less).
The response is `200` with the updated list.

### Errors

| Status | When |
| --- | --- |
| 403 | Any auth failure (`Access denied: …`): missing fields, wrong recipient, wrong lease, older than 10 minutes, bad signature, not a full-access key, or no role on the lease |
| 400 | Empty entry, unreadable body, or the lease could not be read |
| 413 | Image too large |
| 409 | The vault already holds 60 entries |
| 404 | Unknown path or method other than POST |

Live tests for each case: [`tests/api/vault.test.mjs`](tests/api/vault.test.mjs).
