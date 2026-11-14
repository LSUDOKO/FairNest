# Deployment

## What is deployed today (verified)

| Component | Network / host | Address | Verified by |
| --- | --- | --- | --- |
| Escrow + lease NFT | NEAR testnet | [`fairnest-leases.testnet`](https://testnet.nearblocks.io/address/fairnest-leases.testnet), code hash `E6HYb4s46wqmXy2bMQ2pZP7uyZq58QddpWeTah3PhooN` | `tests/onchain/verify.py` §5 (equals the local wasm build) |
| Latest contract deploy | NEAR testnet | tx [`8kRsYp4A…`](https://testnet.nearblocks.io/txns/8kRsYp4AUcnV7reboLz3FUhF29PG4zcbWJenbWbTgP7d) (2026-11-14, audit fixes, state kept) | explorer |
| tUSDC test stablecoin | NEAR testnet | [`fairnest-tusdc.testnet`](https://testnet.nearblocks.io/address/fairnest-tusdc.testnet) | `verify.py` §1 (lease 0 token) |
| Web app + vault Worker + KV | Cloudflare Workers | https://fairnest.adoranto737.workers.dev | `verify.py` §4, `tests/api/vault.test.mjs` |
| Release artifacts | GitHub | [v1.0.0](https://github.com/LSUDOKO/FairNest/releases/tag/v1.0.0): `fairnest.wasm` (the deployed bytes), ABI, `test_token.wasm`, `SHA256SUMS` | `sha256sum -c SHA256SUMS` |

There is no mainnet deployment.

## Prerequisites

- Rust 1.97.1, pinned by `rust-toolchain.toml`, with the `wasm32-unknown-unknown` target.
- [`cargo-near`](https://github.com/near/cargo-near) 0.23.
- [`near` CLI (near-cli-rs)](https://github.com/near/near-cli-rs).
- Node 22.22+ or 24, for the frontend.
- A Cloudflare account and `wrangler` (installed with the frontend's dev dependencies via `npx`), for hosting.

## 1. Contracts (testnet)

```sh
PREFIX=yourname-fn ./scripts/deploy.sh   # creates 6 faucet-funded accounts, builds and deploys both contracts
PREFIX=yourname-fn ./scripts/demo.sh     # optional: runs the full lease flow and prints the result
```

- Keys are written to `~/.near-credentials/testnet/` (the legacy keychain) and **never** to the repo.
- The deploy script calls `new` once.

To upgrade an existing contract while keeping its state, use this command. It only works if the state layout is unchanged:

```sh
(cd contract && cargo near build non-reproducible-wasm)
near contract deploy <escrow>.testnet use-file contract/target/near/fairnest.wasm without-init-call network-config testnet sign-with-legacy-keychain send
python3 tests/onchain/verify.py   # with NEAR_RPC / ESCROW edited for your account
```

If the `Lease` struct changes, deploy to a fresh account (`ESCROW=new-name.testnet ./scripts/deploy.sh`).

**Reproducible build.** `contract/Cargo.toml` carries `[package.metadata.near.reproducible_build]` (a pinned
`sourcescan/cargo-near` image) for `cargo near build reproducible-wasm` on mainnet. The testnet build above is
`non-reproducible-wasm`. Its hash matches only when built with the same toolchain.

## 2. Frontend + vault Worker (Cloudflare)

```sh
cd frontend
npm ci
cp .env.example .env.local          # optional; defaults already point at the testnet deployment
npm run build                       # static export to out/
npx wrangler deploy                 # uploads out/ as assets plus worker/index.ts, binds KV
```

| Setting | Where | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_CONTRACT_ID` | `.env.local` (build time) | escrow contract, default `fairnest-leases.testnet` |
| `NEXT_PUBLIC_TOKEN_ID` | `.env.local` (build time) | stablecoin, default `fairnest-tusdc.testnet` |
| `CONTRACT_ID` | `wrangler.jsonc` `vars` | contract the vault Worker reads roles from |
| `VAULT` KV namespace | `wrangler.jsonc` `kv_namespaces` | vault storage; delete the `id` to let wrangler provision your own |
| `run_worker_first: ["/api/*"]` | `wrangler.jsonc` | only the API hits the Worker; everything else is static |

The app has no secrets. It holds only public contract ids. Wallet keys stay in the user's wallet, and the
function-call key lives in the browser.

Local run of the full stack: `npm run build && npx wrangler dev`. For UI only, without the vault: `npm run dev`.

### Container (optional, local)

`frontend/Dockerfile` builds the static app into nginx and proxies `/api/` to the live Worker, because the vault
needs Cloudflare KV:

```sh
docker build -t fairnest-web frontend && docker run --rm -p 8080:80 fairnest-web   # http://localhost:8080
```

Built and smoke-tested locally on 2026-11-14 (all routes 200; the vault API is proxied). It is not published to a registry.

## 3. CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request, and daily at 06:00 UTC:

| Job | Steps |
| --- | --- |
| Contract | `cargo clippy -D warnings`, `cargo test` (sandbox), wasm build and sha256 |
| Frontend | `npm ci`, ESLint, `tsc --noEmit`, `next build` |
| Dependency audit | `cargo audit` (one documented test-only advisory ignored), `npm audit --omit=dev` |
| Live testnet deployment | `verify.py` and the vault API tests against the deployed contract and Worker |

CI does not deploy. Deploys are manual (above), so no keys are stored in GitHub.

## 4. Mainnet checklist (not done)

1. Fix the open audit items that matter for real money ([AUDIT.md](AUDIT.md)):
   - a minimum window length (F-3);
   - 1 yocto on `accept`, `release_full` and `resolve` (F-4);
   - a token allowlist with USDC only (F-7).
2. Get an independent audit.
3. Do a reproducible build, then verify the source on a NEAR source-verification service.
4. Deploy, check the code hash, then **delete the contract account's full-access key**, or hand upgrades to a DAO.
5. Point the frontend at the mainnet RPC, contract and USDC, and redeploy the Worker.
