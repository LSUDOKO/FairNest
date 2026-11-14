# Integrations

What FairNest uses, what it uses it for, and where to see it. Only implemented items are listed as used. The
rest are in "Not integrated".

## NEAR

| Integration | Utility in FairNest | Code | Evidence |
| --- | --- | --- | --- |
| **near-sdk-rs 5.30** (`#[near]`, `store::Vector`, `store::LookupMap`) | The escrow and NFT contract | `contract/src/lib.rs`, `nft.rs` | 7 sandbox tests |
| **NEP-171 core** (`nft_transfer`, `nft_transfer_call`, `nft_resolve_transfer`, `nft_token`) | The lease *is* the token; the holder is the tenant | `nft.rs` | `lease_nft_moves_the_deposit_and_every_tenant_right`; testnet tx `C6U749WD…` |
| **NEP-177 metadata** | The contract renders the token image as an SVG from the lease stage | `nft.rs` `token()` | `verify.py` §2 |
| **NEP-181 enumeration** | Wallets and the `/profile` page list a holder's leases | `nft.rs` | `verify.py` §2 |
| **NEP-141 fungible tokens** (`ft_transfer_call` → `ft_on_transfer`, `ft_transfer` on withdraw) | Stablecoin deposits in one transaction, and stablecoin payouts | `lib.rs` | `partial_dispute_with_token_and_arbiter`; txs `A6iguWyA…`, `Ce7GGLH1…` |
| **near-contract-standards** | The tUSDC test token (NEP-141 + storage management) | `test-token/` | deployed at `fairnest-tusdc.testnet` |
| **NEP-297 events** | `EVENT_JSON` for every lease step, plus `nep171` mint and transfer events | `lib.rs` `log_event`, `nft.rs` `emit` | visible in the explorer logs of every demo tx |
| **NEP-413 signed messages** | Wallet-signed, off-chain proof of account for the private vault | `frontend/worker/index.ts` | `tests/api/vault.test.mjs` |
| **Access keys** (`view_access_key`, function-call keys, 1-yocto) | The vault accepts only full-access keys. The web app uses a function-call key scoped to 9 methods for popup-free routine calls. NFT transfers need 1 yocto, which forces wallet confirmation | worker; `frontend/src/providers/near-provider.tsx` | `vault.test.mjs` "not a full-access key" |
| **Promises + `#[private]` callbacks** | Safe withdraw with balance restore, and the NFT transfer-call resolution | `lib.rs` `withdraw`/`on_withdraw`, `nft.rs` | `unauthorized_callers_are_rejected`, `partial_dispute…` |
| **Storage staking** | A flat 0.1 NEAR per lease with bounded inputs | `lib.rs` constants | AUDIT F-1 |
| **near-workspaces 0.24** | Sandbox node for the integration tests, with time fast-forwarding | `contract/tests/flows.rs` | CI |
| **cargo-near, near-cli-rs** | Build, deploy, demo script | `scripts/` | deploy tx `8kRsYp4A…` |
| **@hot-labs/near-connect** + `function-call-key-plugin` | Wallet selection, signing, signMessage, and adding the scoped key | `frontend/src/providers/near-provider.tsx` | live app |
| **near-api-js 7** | RPC view calls and encoding in the app | `frontend/src` | live app |
| **NEAR RPC** (`rpc.testnet.near.org`, FastNEAR archival and RPC) | App reads, Worker role checks, verification script | worker, `verify.py` | CI "Live testnet deployment" job |
| **Named accounts** | Readable parties; the arbiter can be any account, including a DAO | everywhere | demo accounts |

## Other infrastructure

| Integration | Utility | Code |
| --- | --- | --- |
| Cloudflare Workers (static assets + Worker) | Hosts the app at the edge; the Worker runs only for `/api/*` | `frontend/wrangler.jsonc`, `frontend/worker/` |
| Cloudflare KV | Off-chain vault photos and notes | `frontend/worker/index.ts` |
| Web Crypto (`crypto.subtle`) | Ed25519 verification and SHA-256 in the Worker; evidence-file hashing in the browser | worker, `frontend/src/lib.ts` |
| Next.js 16 / React 19 / Motion | The static app and its animations | `frontend/src` |
| GitHub Actions | CI: tests, lint, build, audits, live checks | `.github/workflows/ci.yml` |
| Remotion | The demo film project | `video/film/` |

## AI

**The product contains no AI.** No model is called at runtime, and no AI decides anything about money or
access. This is deliberate: deposit outcomes must be predictable and auditable from the contract alone.

AI was used in development:
- writing code and docs with an AI coding assistant;
- the internal, AI-assisted security review in [AUDIT.md](AUDIT.md);
- the character portraits for the demo video.

A possible future integration is in [ROADMAP.md](ROADMAP.md): private comparison of move-in and move-out
photos on NEAR AI Cloud (TEE), which would post only a signed advisory verdict for the arbiter. It is not built.

## Not integrated (listed so nobody assumes otherwise)

- **NEAR Intents / 1Click.** No cross-chain deposit; there is no testnet.
- **Meta-transaction relayer.** Tenants pay their own gas.
- **Sputnik DAO as arbiter.** It would work in principle, since the arbiter is an account id, but it has not been demonstrated.
- **Chain Signatures, NEAR AI, near.social.** Not used.
- **Mainnet USDC.** Testnet uses tUSDC.
