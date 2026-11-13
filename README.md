# FairNest

Rent security-deposit escrow on NEAR. The tenant's deposit sits in a smart contract instead of the
landlord's bank account. At move-out the landlord itemises deductions with evidence, the tenant accepts
or disputes them line by line, and a neutral arbiter rules only on the disputed lines. Deadlines in the
contract stop either side from sitting on the money.

The deposit itself is a **NEP-171 NFT**. Whoever holds the token is the tenant: owed the refund, the only
account that can answer a claim, and the only tenant who can open the lease's private vault. If the
tenant moves out early, the landlord approves a replacement and the NFT, with the deposit and every
right attached to it, moves to them. The old tenant keeps nothing.

Live app (testnet): https://fairnest.adoranto737.workers.dev. Open the settled demo lease at
https://fairnest.adoranto737.workers.dev/lease?id=0 (no wallet needed).

Built at NEAR HACKATHON (Nov 2026). Tracks: NFTs That Do Something (`nfts`), Real-World Money (`realworld`), Open Innovation (`open`).

## The problem

A security deposit is often one or two months of rent. Today the landlord holds it, decides the
deductions alone, and returns it whenever they like. The tenant's only remedy is small-claims court,
which costs more time than most deposits are worth. Landlords have the opposite problem: a tenant who
leaves damage and then claims "it was like that".

## How FairNest works

```
Created --fund--> Funded --file_claim--> Claimed --accept--> Settled
   |                 |                      |
 cancel        release_full            dispute(lines)
   v                 v                      v
Cancelled         Settled               Disputed --resolve (arbiter)--> Settled
```

| Step | Who | What happens |
| --- | --- | --- |
| `create_lease` | landlord | Sets tenant, arbiter, currency (NEAR or a NEP-141 stablecoin), amount, lease end and three deadlines. 0.1 NEAR storage deposit. |
| `fund_native` / `ft_transfer_call` | tenant | Locks the exact deposit in the contract. Wrong token, wrong sender or wrong amount is rejected and refunded. |
| `file_claim` | landlord | After the lease ends: up to 10 deduction lines, each with a reason, amount, evidence link and the evidence file's sha256. Total cannot exceed the deposit. |
| `accept` | tenant | Claim is paid; the rest of the deposit returns to the tenant. |
| `dispute(lines)` | tenant | Undisputed lines and the unclaimed remainder pay out immediately. Only the disputed lines wait for the arbiter. |
| `resolve(to_landlord)` | arbiter | Splits the disputed sum. Cannot award more than what is disputed. |
| `release_full` | landlord | Returns the whole deposit at any time. |
| `finalize` | anyone | Applies an expired deadline (see below). |
| `withdraw(token)` | anyone with a balance | Moves the account's credited share to its wallet. |
| `approve_successor(account)` | landlord | While `Funded`: names the one replacement tenant the lease NFT may move to. |
| `nft_transfer` / `nft_transfer_call` | NFT holder | Hands the lease to the approved replacement (1 yoctoNEAR, so the wallet must confirm). |
| `nft_token`, `nft_tokens_for_owner`, `nft_metadata`, ... | anyone | NEP-171 / 177 / 181 views. The token's image is an SVG drawn by the contract from the lease's current stage. |

Deadlines (per lease, in seconds, so the demo can use minutes):

- Landlord files no claim within `claim_window` after the lease ends: **tenant refunded in full**.
- Tenant neither accepts nor disputes within `response_window`: **claim stands**.
- Arbiter does not rule within `arbiter_window`: **disputed sum returns to the tenant** (the landlord carries the burden of proof).

### Where NEAR fits

- The contract (`contract/src/lib.rs`, near-sdk-rs 5.30) is the custodian. Nobody, including us, can move a deposit outside the rules above.
- Deposits can be native NEAR or any NEP-141 token. The demo uses tUSDC, a 6-decimal test stablecoin with a public faucet (`test-token/`), because there is no official testnet USDC.
- Named accounts make the parties readable (`alice.testnet` vs `bob.testnet`).
- The arbiter is just an account id. In principle it can be a Sputnik DAO that votes on a function-call proposal to `resolve`, so a community or tenants' union becomes the arbiter without new multisig code. This is not demonstrated in this repo yet.
- Every state change is stored in the lease's on-chain `history` and emitted as a NEP-297 event (`EVENT_JSON:{"standard":"fairnest",...}`), so the timeline needs no indexer.
- The web app signs non-payable calls (claim, accept, dispute, resolve, finalize, withdraw, approve successor) with a scoped function-call key limited to this contract, so most steps need no wallet popup.

### Safety choices

- **Pull payments.** Settlement only credits balances; `withdraw` sends the tokens. If a transfer fails (for example the receiver is not registered on the token contract) a callback restores the balance. Funds cannot get lost in a failed promise.
- `ft_on_transfer` checks the calling token contract against the lease's token, per the NEAR docs' guidance; any failure refunds the tenant through the token's resolver.
- Input sizes are capped (10 lines, 300 bytes per text field) so the flat 0.1 NEAR storage deposit always covers the record.
- Each deadline window is capped at 365 days and the lease end at 10 years, so no lease can be set up to stall forever or overflow its deadline arithmetic.

## The lease NFT (track `nfts`)

Code: `contract/src/nft.rs`. Tests: `lease_nft_moves_the_deposit_and_every_tenant_right` and
`transfer_call_to_a_non_contract_returns_the_token` in `contract/tests/flows.rs`.

**What the NFT owns.** Token id = lease id. It is minted to the tenant in the same receipt that locks
the deposit (`nft_mint` event) and never burned; after settlement it stays as the lease's receipt.
The token owner is not a separate map: `nft_token(id).owner_id` *is* `lease.tenant`. Everything
tenant-side reads that one field at call time:

| Right | Where it is checked |
| --- | --- |
| Refund / payout | `credit_settlement`, `dispute`, `resolve` and `finalize` credit `lease.tenant` at the moment they run |
| Answer a claim | `accept` and `dispute` require `caller == lease.tenant` |
| Hand the lease on | `nft_transfer` requires `caller == lease.tenant` |
| Open the private vault | the vault Worker reads `get_lease` on every request and allows `lease.tenant` (plus the landlord, and the arbiter during a dispute) |
| Show up in a wallet | `nft_tokens_for_owner` filters on `lease.tenant` |

**How control passes on transfer.** `nft_transfer(receiver_id, token_id)` with exactly 1 yoctoNEAR
(a full-access key, so the wallet asks the holder to confirm) succeeds only if all of these hold:
the caller is the current holder; the lease is `Funded` (deposit locked, no claim filed); and the
receiver is the replacement the landlord approved with `approve_successor`. In that one receipt the
contract sets `lease.tenant = receiver`, clears the approval, logs a `transferred` history event and a
standard `nft_transfer` event. From the next block on, every check in the table above sees the new holder.

**Threat model: every way the seller (old tenant) could try to keep the money or access.**

| Attack | Why it fails |
| --- | --- |
| Keep calling `accept`/`dispute` after selling | Both check `lease.tenant` live; the old tenant gets `only tenant`. Tested. |
| Sell during a payout so part goes to each | Transfer is only allowed in `Funded`. Once a claim is filed the token is frozen until settlement, so no payout is ever split. The undisputed share credited at dispute time belongs to whoever held the token then. Tested ("mid-payout"). |
| Keep a balance credited before the sale | Nothing is credited while `Funded`, the only state a sale can happen in. Every credit goes to the holder at that moment. |
| Pull the token back later | Only the current holder can transfer, and only to a landlord-approved account. The approval is single-use and cleared on transfer. Tested. |
| Leave an approval or operator behind | NEP-178 approvals are not implemented (`approval_id` must be empty), so no marketplace or operator can move the token for the old owner. |
| `nft_transfer_call` to a contract that grabs and returns it | `nft_resolve_transfer` only returns the token if the receiver still holds it **and** the lease is still `Funded`, so a receiver cannot act on the lease in the callback window and then hand it back. Tested with a receiver that has no contract: the token comes back to the sender. |
| Use the vault with an old browser session | There is no session. Each vault request carries a fresh NEP-413 signature (valid 10 minutes), the Worker checks the key is a full-access key of that account, then reads the current holder from the chain. Verified on the live deployment: after the transfer the old tenant gets 403. |
| Sign the vault request with a limited function-call key | Rejected: only full-access keys count. |
| Sell to a stranger the landlord never vetted | The receiver must be the approved successor. Same rule as a real lease assignment. |
| Transfer before funding to dodge the deposit | No token exists until the exact deposit is locked. |

Not covered by code: payment between the old and new tenant for the deposit they take over. Today that
is agreed off-chain; a `nft_transfer_call` into a sale contract that pays the old tenant first is the
next step.

**Gated page.** `/vault?id=N` holds move-in/move-out inspection photos and notes off-chain in
Cloudflare KV (anything on-chain is public). The Worker in `frontend/worker/index.ts` checks the
NEP-413 signature, that the key is a full-access key (`view_access_key`), and the holder on-chain, on
every request.

**History per NFT.** The lease page shows the token's live image, every holder with dates (from the
`funded`, `transferred` and `transfer_returned` history events), what was paid in, every claim line and
both payouts. `/profile?account=` shows the lease NFTs an account holds and a **clean move-out** badge
for each lease it held at settlement with the full deposit returned. The badge is derived from
on-chain history, so it cannot be bought or transferred.

## Live testnet deployment

| What | Account |
| --- | --- |
| Escrow + lease NFT contract | [`fairnest-leases.testnet`](https://testnet.nearblocks.io/address/fairnest-leases.testnet) |
| tUSDC test token (public `mint`) | [`fairnest-tusdc.testnet`](https://testnet.nearblocks.io/address/fairnest-tusdc.testnet) |
| Demo landlord / tenant / replacement tenant / arbiter | `fairnest-landlord.testnet`, `fairnest-tenant.testnet`, `fairnest-tenant2.testnet`, `fairnest-arbiter.testnet` |

(`fairnest-escrow.testnet` runs the earlier version without the NFT; its lease 0 is a finished dispute too.)

Lease `0` was run by `scripts/demo.sh`: the first tenant handed the lease NFT to a replacement, who then
disputed one deduction. Check it without installing anything:

```sh
curl -s https://rpc.testnet.near.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"fairnest-leases.testnet","method_name":"get_lease","args_base64":"eyJsZWFzZV9pZCI6IjAifQ=="}}' | python3 -c 'import sys,json;print(bytes(json.load(sys.stdin)["result"]["result"]).decode())'
```

You should see `"status":"Settled"`, `"tenant":"fairnest-tenant2.testnet"`, `"to_landlord":"300000000"` and
`"to_tenant":"1200000000"` (300 and 1200 tUSDC), and a `transferred` event in `history`. The NFT itself:
replace `get_lease` with `nft_token` and the args with `eyJ0b2tlbl9pZCI6IjAifQ==` (`{"token_id":"0"}`) to see
`"owner_id":"fairnest-tenant2.testnet"` and the SVG image.

| Step | Transaction |
| --- | --- |
| Landlord creates a 1500 tUSDC lease | [6VQemHAy...](https://testnet.nearblocks.io/txns/6VQemHAyAXGPvcjUxLjtpb5AH98uaqn3t1cTDQtW5wBS) |
| Tenant locks the deposit, lease NFT minted | [A6iguWyA...](https://testnet.nearblocks.io/txns/A6iguWyAXeFebXhnSZ6Gz5NQLdQUZ1Kdt5XqUKFEapd8) |
| Landlord approves a replacement tenant | [GJdf6DsZ...](https://testnet.nearblocks.io/txns/GJdf6DsZHdbbAiwn7aVFKR6JFyMLQSxk79HfZqhH5zRs) |
| Tenant hands the lease NFT over (`nft_transfer`) | [C6U749WD...](https://testnet.nearblocks.io/txns/C6U749WD8ghsMqsVJSf2A4hFANCiCXiu3M76QK8qqYwB) |
| Landlord claims 200 cleaning + 400 carpet | [7whGQPhF...](https://testnet.nearblocks.io/txns/7whGQPhFCAyRd9Q1TFzAGwvW7RbHhswVq79EaJAXhi77) |
| Replacement tenant disputes the carpet line | [FUdqxMTE...](https://testnet.nearblocks.io/txns/FUdqxMTEpmHFUk6zvsNyGiNWVD2QQRUtfgfXBdkyuE1Q) |
| Arbiter awards 100 of the 400 to the landlord | [6R1YjfpT...](https://testnet.nearblocks.io/txns/6R1YjfpTe1YaB13kCtrtJi2aspaqnHKmK2gia2gGW5Za) |
| Replacement tenant withdraws 1200 tUSDC | [Ce7GGLH1...](https://testnet.nearblocks.io/txns/Ce7GGLH15pFVwG1p1gszziDyX4agyktjvXvUYW7gGX5u) |
| Landlord withdraws 300 tUSDC | [HPxB6rfb...](https://testnet.nearblocks.io/txns/HPxB6rfbtj9d3cTk8y1ACx5TzH8aM7gemGD2Bw6E89YR) |

## Try it

### Path A: local sandbox, no account or funds needed (about 5 minutes, mostly compile time)

Prerequisites: Rust (the repo pins 1.97.1 in `rust-toolchain.toml`) and `cargo-near`. The quickest
install is the official prebuilt binary from the NEAR docs:
`curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh`.
Fallback: `cargo install cargo-near --locked` (about 15 minutes; on GCC 16 systems prefix it with
`CC=clang CXX=clang++`).
The first run downloads a local NEAR sandbox node and takes a few minutes; the six tests run in about 3 minutes.

1. `cd contract && cargo test -- --nocapture`
2. See six tests pass (plus one unit test). Each prints the steps it runs:
   - `happy_path_native_near`: 5 NEAR deposit, 1.5 NEAR claim accepted, tenant withdraws 3.5 NEAR.
   - `partial_dispute_with_token_and_arbiter`: 1000 tUSDC deposit, landlord claims 100 + 300, tenant disputes the 300, 100 and 600 pay out at once, arbiter awards 100 of the 300. The landlord's first withdraw fails because they are not registered on the token, and the balance is restored; after `storage_deposit` the withdraw succeeds.
   - `timeouts_protect_both_sides`: each of the three deadlines settles the lease the way listed above.
   - `lease_nft_moves_the_deposit_and_every_tenant_right`: funding mints the NFT; transfers without approval, by a non-holder, to an unapproved account or without 1 yocto fail; the approved hand-over works; the old tenant can no longer accept, dispute, pull the token back or withdraw anything; a transfer attempt mid-payout (during the dispute) is rejected; the replacement is credited 3.25 NEAR and the NFT image reads "Closed".
   - `transfer_call_to_a_non_contract_returns_the_token`: `nft_transfer_call` to an account with no receiver contract returns the token to the tenant.
   - `guards_reject_bad_input`: wrong funder, wrong amount, wrong token (refunded), early claim, over-deposit claim and deadline windows above 365 days are all rejected.

### Path B: testnet from the command line

Prerequisites: Path A plus the `near` CLI:
`curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh`
(or `npm install -g near-cli-rs`).

1. `PREFIX=<unique-name> ./scripts/deploy.sh` creates six faucet-funded testnet accounts (`<prefix>-escrow`, `-tusdc`, `-landlord`, `-tenant`, `-tenant2`, `-arbiter`), builds and deploys both contracts. Keys go to `~/.near-credentials`.
2. `PREFIX=<unique-name> ./scripts/demo.sh` runs the full flow: 1500 tUSDC deposit, the tenant hands the lease NFT to `-tenant2`, 200 + 400 claim, carpet disputed by the new holder, arbiter awards 100.
3. See `"owner_id": "<prefix>-tenant2.testnet"` after the hand-over, then the final lease with `"status": "Settled"`, `to_landlord` 300 tUSDC and `to_tenant` 1200 tUSDC, then the replacement tenant's and landlord's token balances. Every transaction is listed at `https://testnet.nearblocks.io/address/<prefix>-escrow.testnet`.

### Path C: the web app

Hosted: https://fairnest.adoranto737.workers.dev (skip to step 4). To run it locally:

1. `cd frontend && npm install`
2. Optional: `cp .env.example .env.local`. The defaults point at the FairNest testnet deployment below.
   To use your own deployment, put the ids printed by `deploy.sh` there.
3. `npm run dev`, open http://localhost:3000. To host your own copy on Cloudflare: `npm run build && npx wrangler deploy` (static export in `out/` plus the vault Worker in `worker/`, config in `frontend/wrangler.jsonc`; remove the KV `id` there to provision your own). The vault needs the Worker, so locally use `npm run build && npx wrangler dev`.
4. Use three testnet wallets (any wallet in the connector, for example Meteor or Intear; switch the wallet to testnet):
   1. As the **landlord**: click "Create a lease" (or "New lease" in the menu), enter the tenant and arbiter accounts, keep the 2-minute defaults. See the lease page with status `Created`.
   2. As the **tenant**: on the Dashboard click "Get 1,000 tUSDC" (twice for a 1500 deposit), open the lease by its number, click "Deposit". See status `Funded`.
   3. As the **landlord**, after the lease end time: add deduction lines, optionally fingerprint a photo (its sha256 is shown and stored), click "File N deductions". See status `Claimed` and a countdown.
   4. As the **tenant**: tick one line, write a reason, click "Dispute 1 line". See status `Disputed` and the landlord/tenant split for the undisputed part.
   5. As the **arbiter**: enter the amount for the landlord, click "Submit ruling". See status `Settled`.
   6. Each party: on the Dashboard click "Withdraw tUSDC". See the success link to the transaction.
   7. Or skip a step and wait for the deadline: the lease page shows "Apply the passed deadline", and anyone can click it.
   8. NFT hand-over (needs a fourth wallet), any time while the lease is `Funded`: as the **landlord**, on the lease page's "Lease NFT" panel enter the replacement account and click "Approve replacement". As the **tenant**, click "Hand over the lease" and confirm in the wallet. See the holder change and both accounts in the holder list. The old tenant's lease page now says they handed it over and shows no tenant actions.
   9. Vault: click "Open the private vault", then "Unlock the vault" (your wallet signs a message, free). Add a move-in note or photo. Open the same page as the old tenant after a hand-over: see "Access denied".
   10. Record: "Record" in the menu, or `/profile?account=<account>`, shows the lease NFTs an account holds and its clean move-out badges.
5. "CSV for your records" on any lease downloads the timeline, deduction lines and final split.

## Failure cases

- **Arbiter disappears or loses keys.** The arbiter deadline returns the disputed sum to the tenant. Undisputed money was already paid out. Using a DAO as arbiter removes the single key.
- **Hostile landlord** claims the whole deposit. The tenant disputes every line; nothing moves until the arbiter rules, and a silent arbiter favours the tenant.
- **Hostile or absent tenant.** If they never respond, the claim stands after the response window. If they never fund, the landlord cancels the lease.
- **Landlord forgets to claim.** The tenant (or anyone) applies the claim deadline and gets a full refund.
- **Colluding landlord and arbiter.** Not solved by code: pick an arbiter both sides trust before signing, which is the same trust a lease agreement already needs. The arbiter cannot award more than the disputed lines.
- **Wrong token sent.** `ft_on_transfer` rejects it and the token contract refunds the sender.
- **Receiver not registered on the token.** `withdraw` fails safely and the balance stays claimable.

## Repository layout

```
contract/          FairNest escrow + lease NFT (near-sdk-rs; src/nft.rs = NEP-171/177/181), tests/flows.rs = sandbox demo
test-token/        tUSDC, NEP-141 with a public faucet mint (testnet only)
frontend/          Next.js app (create-near-app template, @hot-labs/near-connect, near-api-js, Motion)
frontend/worker/   Cloudflare Worker: serves the app and the NEP-413-gated vault API (KV)
scripts/           deploy.sh and demo.sh for testnet (near-cli-rs)
```

## Built with

near-sdk-rs and near-contract-standards 5.30, near-workspaces 0.24, cargo-near, near-cli-rs,
Next.js 16 from `create-near-app`, `@hot-labs/near-connect`, `near-api-js` 7, `function-call-key-plugin`,
Motion, Cloudflare Workers + KV. Photos on the landing page are from Unsplash (credited in place). All code was written during the hackathon window, with help from an AI coding assistant.

## Not built (yet)

- A lease as its own sub-account (`lease-42.fairnest.testnet`) that holds the deposit, controlled by the NFT holder, as in the Top Level Accounts design. The single-field ownership above already gives the same guarantees inside one contract.
- Paying the outgoing tenant for the deposit they hand over, through `nft_transfer_call` into a small sale contract.
- Private AI comparison of move-in and move-out vault photos on NEAR AI Cloud (TEE), posting only a signed verdict through a function-call key that cannot touch money.
- A Sputnik DAO as arbiter, and a public near.social review after a lease closes.

- Gasless tenants through a meta-transaction relayer.
- Interest on held deposits (required in some jurisdictions).
- Cross-chain deposits through NEAR Intents (no testnet exists).
- Hosted evidence upload; today evidence is a link plus the file's sha256.

## License

MIT, see `LICENSE`.
