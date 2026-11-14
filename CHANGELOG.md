# Changelog

All dates are UTC. Versions follow the GitHub releases.

## [1.0.0] - 2026-11-14

NEAR HACKATHON submission. [Release](https://github.com/LSUDOKO/FairNest/releases/tag/v1.0.0).

### Security
- Internal security review: [AUDIT.md](AUDIT.md), with 10 findings.
- Fixed F-1: `approve_successor` is capped at 16 history events, so records cannot grow without being paid for.
- Fixed F-2: a late `accept`, `dispute` or `resolve` is rejected after its deadline.
- Fixed F-5: lease and token ids cannot alias each other (`u32::try_from`, canonical token ids).
- Redeployed to `fairnest-leases.testnet` with state kept (tx `8kRsYp4A…`).

### Added
- `tests/onchain/verify.py`: 29 live testnet checks, including deployed code hash = local build.
- `tests/api/vault.test.mjs`: 11 live NEP-413 vault API cases.
- Sandbox test `unauthorized_callers_are_rejected`, covering roles, private callbacks and money conservation.
- GitHub Actions CI: clippy, sandbox tests, wasm build, frontend lint/types/build, cargo and npm audit, and daily live checks.
- Docs: ARCHITECTURE, API, SECURITY, TESTING, DEPLOYMENT, INTEGRATIONS, BUSINESS, ROADMAP, JUDGES, CONTRIBUTING.
- Brand assets, app screenshots, demo video, and the `frontend/Dockerfile` for a local container.

## [0.3.0] - 2026-11-13 to 14: lease NFT

- Each funded lease is a NEP-171/177/181 NFT whose owner is the tenant, with an on-chain SVG.
- Hand-over to a landlord-approved replacement; transfer only while `Funded`.
- NEP-413-gated private vault on a Cloudflare Worker with KV.
- Rental record page and clean move-out badges.
- Deployed to `fairnest-leases.testnet`; demo lease 0 run with a hand-over and a dispute.

## [0.2.0] - 2026-11-07: web app

- Next.js app: landing page, dashboard, create lease, role-aware lease page, CSV export.
- Hosted on Cloudflare Workers.

## [0.1.0] - 2026-11-06 to 07: escrow

- Escrow contract: itemised claims with evidence sha256, line-level disputes, arbiter, three deadlines, pull payments.
- tUSDC test token, sandbox tests, and testnet deploy and demo scripts (`fairnest-escrow.testnet`).
