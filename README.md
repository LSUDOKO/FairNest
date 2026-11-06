# FairNest

Rent security-deposit escrow on NEAR. The tenant's deposit sits in a smart contract instead of the
landlord's bank account. At move-out the landlord itemises deductions with evidence, the tenant accepts
or disputes them line by line, and a neutral arbiter rules only on the disputed lines. Deadlines in the
contract stop either side from sitting on the money.

Built at NEAR HACKATHON (Nov 2026). Tracks: Real-World Money (`realworld`), Open Innovation (`open`).

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
- The web app signs non-payable calls (claim, accept, dispute, resolve, finalize, withdraw) with a scoped function-call key limited to this contract, so most steps need no wallet popup.

### Safety choices

- **Pull payments.** Settlement only credits balances; `withdraw` sends the tokens. If a transfer fails (for example the receiver is not registered on the token contract) a callback restores the balance. Funds cannot get lost in a failed promise.
- `ft_on_transfer` checks the calling token contract against the lease's token, per the NEAR docs' guidance; any failure refunds the tenant through the token's resolver.
- Input sizes are capped (10 lines, 300 bytes per text field) so the flat 0.1 NEAR storage deposit always covers the record.
- Each deadline window is capped at 365 days and the lease end at 10 years, so no lease can be set up to stall forever or overflow its deadline arithmetic.

## Live testnet deployment

| What | Account |
| --- | --- |
| Escrow contract | [`fairnest-escrow.testnet`](https://testnet.nearblocks.io/address/fairnest-escrow.testnet) |
| tUSDC test token (public `mint`) | [`fairnest-tusdc.testnet`](https://testnet.nearblocks.io/address/fairnest-tusdc.testnet) |
| Demo landlord / tenant / arbiter | `fairnest-landlord.testnet`, `fairnest-tenant.testnet`, `fairnest-arbiter.testnet` |

Lease `0` is a finished dispute run by `scripts/demo.sh`. Check it without installing anything:

```sh
curl -s https://rpc.testnet.near.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"fairnest-escrow.testnet","method_name":"get_lease","args_base64":"eyJsZWFzZV9pZCI6IjAifQ=="}}' | python3 -c 'import sys,json;print(bytes(json.load(sys.stdin)["result"]["result"]).decode())'
```

You should see `"status":"Settled"`, `"to_landlord":"300000000"` and `"to_tenant":"1200000000"` (300 and 1200 tUSDC).

| Step | Transaction |
| --- | --- |
| Landlord creates a 1500 tUSDC lease | [4K9AKih2...](https://testnet.nearblocks.io/txns/4K9AKih2vrEjW9bkTYemsi6CvN44ANSP13FbtCQuKavn) |
| Tenant locks the deposit (`ft_transfer_call`) | [BebqDpKU...](https://testnet.nearblocks.io/txns/BebqDpKUyVBAzazvf6iMqXsEorpJwvfQ3PTxxUdNnoUa) |
| Landlord claims 200 cleaning + 400 carpet | [4ZQQfyid...](https://testnet.nearblocks.io/txns/4ZQQfyidip8Nmydn1BRr55i72c36VxV2e1jALCUZd9HY) |
| Tenant disputes the carpet line only | [8sRkyPM2...](https://testnet.nearblocks.io/txns/8sRkyPM25xUFU8X47sGAGvFcArByxWFFpLRvbE9PiFw) |
| Arbiter awards 100 of the 400 to the landlord | [34Yj2Ucg...](https://testnet.nearblocks.io/txns/34Yj2UcgTW46qfFm5rV8L6pY5ErTBjndWjfuzAQY4KLq) |
| Tenant withdraws 1200 tUSDC | [Hq8Josgt...](https://testnet.nearblocks.io/txns/Hq8Josgt7tZofRPYb3Tq1bQc1zVXPEnScCUnFvQmyQr7) |
| Landlord withdraws 300 tUSDC | [j5zKqi4P...](https://testnet.nearblocks.io/txns/j5zKqi4P8P6cMkYmkm8DtsQjqNB8kCYjGdM1tLfb93D) |

## Try it

### Path A: local sandbox, no account or funds needed (about 5 minutes, mostly compile time)

Prerequisites: Rust (the repo pins 1.97.1 in `rust-toolchain.toml`) and `cargo-near`. The quickest
install is the official prebuilt binary from the NEAR docs:
`curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh`.
Fallback: `cargo install cargo-near --locked` (about 15 minutes; on GCC 16 systems prefix it with
`CC=clang CXX=clang++`).
The first run downloads a local NEAR sandbox node and takes a few minutes; the four tests run in about 3 minutes.

1. `cd contract && cargo test -- --nocapture`
2. See four tests pass. Each prints the steps it runs:
   - `happy_path_native_near`: 5 NEAR deposit, 1.5 NEAR claim accepted, tenant withdraws 3.5 NEAR.
   - `partial_dispute_with_token_and_arbiter`: 1000 tUSDC deposit, landlord claims 100 + 300, tenant disputes the 300, 100 and 600 pay out at once, arbiter awards 100 of the 300. The landlord's first withdraw fails because they are not registered on the token, and the balance is restored; after `storage_deposit` the withdraw succeeds.
   - `timeouts_protect_both_sides`: each of the three deadlines settles the lease the way listed above.
   - `guards_reject_bad_input`: wrong funder, wrong amount, wrong token (refunded), early claim, over-deposit claim and deadline windows above 365 days are all rejected.

### Path B: testnet from the command line

Prerequisites: Path A plus the `near` CLI:
`curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh`
(or `npm install -g near-cli-rs`).

1. `PREFIX=<unique-name> ./scripts/deploy.sh` creates five faucet-funded testnet accounts (`<prefix>-escrow`, `-tusdc`, `-landlord`, `-tenant`, `-arbiter`), builds and deploys both contracts. Keys go to `~/.near-credentials`.
2. `PREFIX=<unique-name> ./scripts/demo.sh` runs one full dispute: 1500 tUSDC deposit, 200 + 400 claim, carpet disputed, arbiter awards 100.
3. See the final lease printed with `"status": "Settled"`, `to_landlord` 300 tUSDC and `to_tenant` 1200 tUSDC, then the two token balances. Every transaction is listed at `https://testnet.nearblocks.io/address/<prefix>-escrow.testnet`.

### Path C: the web app

1. `cd frontend && npm install`
2. Optional: `cp .env.example .env.local`. The defaults point at the FairNest testnet deployment below.
   To use your own deployment, put the ids printed by `deploy.sh` there.
3. `npm run dev`, open http://localhost:3000.
4. Use three testnet wallets (any wallet in the connector, for example Meteor or Intear; switch the wallet to testnet):
   1. As the **landlord**: click "New lease", enter the tenant and arbiter accounts, keep the 2-minute defaults. See the lease page with status `Created`.
   2. As the **tenant**: on the home page click "Get 1000 test tUSDC" (twice for a 1500 deposit), open the lease by id, click "Deposit". See status `Funded`.
   3. As the **landlord**, after the lease end time: add deduction lines, optionally fingerprint a photo (its sha256 is shown and stored), click "File claim". See status `Claimed` and a countdown.
   4. As the **tenant**: tick one line, write a reason, click "Dispute". See status `Disputed` and "Paid so far" for the undisputed part.
   5. As the **arbiter**: enter the amount for the landlord, click "Submit ruling". See status `Settled`.
   6. Each party: on the home page click "Withdraw tUSDC". See the success link to the transaction.
   7. Or skip a step and wait for the deadline: the lease page shows "Deadline passed: apply it", and anyone can click it.
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
contract/          FairNest escrow (near-sdk-rs), tests/flows.rs = sandbox demo
test-token/        tUSDC, NEP-141 with a public faucet mint (testnet only)
frontend/          Next.js app (create-near-app template, @hot-labs/near-connect, near-api-js)
scripts/           deploy.sh and demo.sh for testnet (near-cli-rs)
```

## Built with

near-sdk-rs and near-contract-standards 5.30, near-workspaces 0.24, cargo-near, near-cli-rs,
Next.js 16 from `create-near-app`, `@hot-labs/near-connect`, `near-api-js` 7, `function-call-key-plugin`,
Bootstrap 5. All code was written during the hackathon window, with help from an AI coding assistant.

## Not built (yet)

- Gasless tenants through a meta-transaction relayer.
- Interest on held deposits (required in some jurisdictions).
- Cross-chain deposits through NEAR Intents (no testnet exists).
- Hosted evidence upload; today evidence is a link plus the file's sha256.

## License

MIT, see `LICENSE`.
