# Roadmap

This is a plan, not a promise. Nothing below is built unless the "Status" column says so. Order matters:
safety before reach.

## Now: testnet (built)

| Item | Status |
| --- | --- |
| Escrow with itemised claims, line-level disputes, arbiter, three deadlines | built, tested, live |
| Lease NFT (NEP-171/177/181) carrying deposit, refund and tenant rights; landlord-approved hand-over | built, tested, live |
| NEP-413-gated private vault | built, live-tested |
| Internal security review; F-1, F-2, F-5 fixed | done ([AUDIT.md](AUDIT.md)) |
| CI with daily live checks | done |

## Next: mainnet readiness

| Item | Why |
| --- | --- |
| Minimum response and arbiter windows (for example 3 days), plus a UI warning before funding | AUDIT F-3: a landlord could choose an unfair window |
| 1 yocto on `accept`, `release_full`, `resolve` | AUDIT F-4: wallet confirmation for irreversible decisions |
| Token allowlist (USDC), with the token shown in NFT metadata | AUDIT F-7: no fake "funded" NFTs |
| Paginated per-account index (`IterableSet`) | AUDIT F-6 |
| Storage metered with `env::storage_usage()` instead of a flat fee | AUDIT F-1 residual |
| Successor accepts the hand-over on-chain | AUDIT F-10 |
| Independent third-party audit, reproducible build, source verification | real money |
| Delete the contract account's full-access key, or put upgrades behind a DAO | AUDIT F-9: removes the developer trust assumption |

## Later: product

| Item | What it adds |
| --- | --- |
| Sputnik DAO arbiter demo | A community or tenants' union rules by vote; no new contract code needed |
| Meta-transaction relayer for calls to this contract only | Tenants never buy NEAR for gas |
| USDC deposits from any chain through NEAR Intents / 1Click | Renters pay with what they hold (needs mainnet) |
| Paid hand-over: `nft_transfer_call` into a sale contract that pays the outgoing tenant | The deposit is bought, not gifted, when a lease is taken over |
| Lease as its own sub-account (Top Level Accounts style) controlled by the NFT holder | The deposit sits in an account the holder controls |
| Private AI comparison of move-in and move-out vault photos on NEAR AI Cloud (TEE), posting only a signed, advisory verdict | Faster, cheaper arbitration; the arbiter still decides |
| Interest on held deposits where the law requires it | Compliance in those jurisdictions |
| Property-manager dashboard (many leases, CSV/ledger export) | B2B use; see [BUSINESS.md](BUSINESS.md) |

The legal and regulatory work, for example operating with or as an authorised deposit scheme in the UK, is
covered in [BUSINESS.md](BUSINESS.md) and gates any production launch.
