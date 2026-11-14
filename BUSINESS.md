# FairNest: Business Case

**Status (Nov 2026):** NEAR testnet only. No customers, no revenue, no partnerships, no mainnet deployment. Everything under "Opportunity" is a hypothesis that has not been tested.

## 1. Today (built)

FairNest is a rent security-deposit escrow contract on NEAR.

- **Custody.** The tenant locks the deposit in the contract, in NEAR or a NEP-141 stablecoin. The landlord never holds it.
- **Itemised claims.** At move-out the landlord files deductions line by line. Each line carries an evidence link and its sha256 hash.
- **Line-level disputes.** The tenant accepts or disputes each line. Undisputed money pays out immediately, and a neutral arbiter (any account) rules only on the disputed lines.
- **Deadlines settle silence.** When a claim, response or arbiter window passes, anyone can call `finalize` and the contract applies the default:

  | Silent party | Outcome |
  |---|---|
  | Landlord | Full refund to tenant |
  | Tenant | Claim stands |
  | Arbiter | Disputed sum to tenant |

- **Transferable lease.** Each funded lease is a NEP-171 NFT held by the tenant. It can move to a replacement tenant the landlord has approved, with the deposit going along with it.
- **Private inspection vault.** Photos and notes are gated by NEAR signed messages.
- **No AI.** The product contains no AI or ML.

## 2. Market

| Market | Figure | Source |
|---|---|---|
| England & Wales | 4,706,470 protected deposits worth £5.53 billion; average £1,175 (TDS Statistical Briefing 2025, 2024/25 data) | [Property118, Dec 2025](https://www.property118.com/deposit-disputes-remain-rare-despite-rising-rents-tds/) |
| England & Wales | 4.72 million deposits (Sept 2025); 54.0% held in custodial schemes; average £1,195 | [DPS PRS Review, Feb 2026](https://content-assets.computershare.com/eh96rkuu9740/6ePgEfNyqRWnYwEYtxlIqy/ec28d15e39c6d94e3e76686286001b17/PRS_review_February_2026.pdf) |
| United States | 46,251 thousand renter-occupied housing units (Q3 2026, Census HVS) | [FRED ERNTOCCUSQ176N](https://fred.stlouisfed.org/data/ERNTOCCUSQ176N) |
| United States | 34.8% of households renting (2023 ACS) | [US Census Bureau, Sept 2024](https://www.census.gov/library/stories/2024/09/acs-rent-burden.html) |
| United States | 22.7 million cost-burdened renter households (49%) in 2024 | [Harvard JCHS, Mar 2026](https://www.jchs.harvard.edu/blog/six-takeaways-americas-rental-housing-2026) |
| United States | "$45 billion is locked up in residential security deposits" (a Bloomberg estimate quoted second-hand, 2021) | [RealPage, Jul 2021](https://www.realpage.com/blog/what-property-managers-need-to-know-about-deposit-insurance/) |
| India | 28% of urban Indians live in rented housing (Economic Survey 2017-18) | [Mint, Jan 2018](https://www.livemint.com/Politics/ixPbHQK7HGSOpUnoZnu7lO/Only-28-of-Urban-India-lives-in-rented-houses-Economic-Sur.html) |
| India (Bengaluru) | Brokers say deposits fell from ten months' rent to about six after the Model Tenancy Act 2021, which sets a two-month template cap | [BusinessLine, Nov 2025](https://www.thehindubusinessline.com/news/real-estate/why-bengalurus-rental-market-ignores-the-two%E2%80%90month-deposit-cap/article70295207.ece); [PRS India](https://prsindia.org/billtrack/the-model-tenancy-act-2021) |

**Formal disputes are rare.** Only 46,950 England & Wales cases went to formal adjudication in 2024/25, about 1% of deposits. Scotland's rate was 2.44% ([Property118](https://www.property118.com/deposit-disputes-remain-rare-despite-rising-rents-tds/)).

## 3. Existing solutions and gaps

| Provider | What it does (per its own site or press) | Gap FairNest could address |
|---|---|---|
| **UK statutory schemes: [DPS](https://www.depositprotection.com/about-us), [mydeposits](https://www.mydeposits.co.uk/), [TDS](https://www.tdsgroup.uk/resolution-service)** | Government-authorised. Custodial protection is free ([gov.uk](https://www.gov.uk/deposit-protection-schemes-and-landlords)), and so is adjudication. DPS reports 7.2+ million deposits protected since 2007. mydeposits states "over £1.3 billion" protected (undated, accessed Nov 2026). | Little on price, since they are free. Possibly speed: gov.uk only requires repayment "within 10 days" of agreement ([gov.uk](https://www.gov.uk/tenancy-deposit-protection)). |
| **[Rhino](https://5386003.fs1.hubspotusercontent-na1.net/hubfs/5386003/How%20Rhino%20Works.pdf) and [Jetty](https://jettyplusrhino.zendesk.com/hc/en-us/articles/36267756309908-Renter-What-is-Jetty-Deposit-and-how-does-it-work) (US), now marketed as ["Rhino + Jetty"](https://get.sayrhino.com/hubfs/9205635/RENTER_%20Rhino%20%2B%20Jetty%20Fact%20Sheet_022025%20(6).pdf?hsLang=en)** | Replace the deposit with a non-refundable premium; Rhino policies "start as low as $4 a month". Renters must reimburse Rhino for paid claims ([Business Insider](https://www.businessinsider.com/personal-finance/homeowners-insurance/what-is-rhino-insurance)), and Jetty recovers unpaid damage from the renter. | Renters pay a fee they never get back and stay liable anyway. FairNest keeps the deposit refundable. |
| **[Obligo](https://www.obligo.com/faq) (US)** | Billing authorisation instead of a cash deposit. The fee is set by an ML model, and charges are capped at the deposit amount. Disputes go "directly with your property or via a small claims court". Full deposits can earn "up to 2% APY where applicable" ([Obligo](https://www.obligo.com/for-renters)). | Disputes have no neutral adjudicator. |
| **[LeaseLock](https://leaselock.com/lease-insurance/) (US)** | Lease insurance sold to properties. Its site says "No subrogation… We are true insurance." | Built for operators, not for renters who want their own cash back. |
| **[Zero Deposit](https://www.zerodeposit.com/tenants/) (UK)** | Charges about one week's rent, plus a £59.99 set-up fee and £17.50 a year. FCA-regulated, with disputes adjudicated by TDS. | Non-refundable cost to the tenant. |
| **[Reposit](https://support.reposit.co.uk/en/articles/11485229-general-faqs) (UK)** | Charges one week's rent (minimum £150), non-refundable, and gives the landlord up to eight weeks' cover. | Same as Zero Deposit. |

**Where FairNest differs:**

- The deposit stays the tenant's money.
- Undisputed lines pay out at once instead of waiting on the whole claim.
- Deadlines remove the "silent party" problem.
- The lease and its deposit can move to a replacement tenant.
- The audit trail is public on-chain, and evidence is pinned by hash.

None of these differences has been tested with users.

## 4. Opportunity (not built)

### Customer segments

All of these are hypotheses with no validation interviews yet.

| Segment | Why they might adopt | Main blocker |
|---|---|---|
| Co-living and student-housing operators | High tenant turnover, frequent replacement tenants (NFT handover), and many small deductions | Need fiat on/off-ramps and accounting exports |
| Property managers in markets without a statutory scheme | Itemised, time-boxed settlement and a neutral record | Local deposit law (see §5) |
| Cross-border renters and expats | Can fund a deposit in stablecoin without a local bank account | Landlord must accept crypto |
| Indian metros with multi-month deposits | Large informal deposits and little neutral custody | Rupee rails, enforceability, landlord demand |
| Stablecoin-holding renters | Already hold the currency | Small, early niche |

**Go-to-market hypothesis:** start with one co-living or student operator in a jurisdiction that allows it, run with the operator as landlord and an independent arbiter. Then measure time to settle and the dispute rate before expanding.

### Revenue models

Each model has a stated dependency.

| Model | Dependency |
|---|---|
| Flat or percentage settlement fee. For illustration only, not a forecast: 0.5% of the £1,175 average deposit would be about £5.88 per lease. | Must beat schemes that are free in the UK; works better where no free scheme exists |
| Arbiter marketplace fee (cut of a per-dispute arbiter fee) | Needs qualified arbiters and enough disputes, which run at about 1% of deposits |
| B2B SaaS for operators (dashboards, exports, inspection vault) | Operator demand, still unvalidated |
| Yield on held deposits | Restricted by law: Massachusetts requires the deposit in a separate interest-bearing account in a Massachusetts bank, held in trust, with interest owed to the tenant ([Mass.gov](https://www.mass.gov/info-details/learn-about-holding-a-security-deposit)). New York owes tenants interest in buildings with six or more units, and the landlord may keep a 1% admin fee ([NY AG](https://ag.ny.gov/resources/individuals/tenants-homeowners/tenants/recovering-rent-security-deposits-and-interest)). The contract earns no yield today, and adding DeFi yield adds risk of loss. |

## 5. Regulatory constraints

- **UK.** Deposits for assured periodic tenancies, which replaced assured shorthold tenancies on 1 May 2026, must be placed with DPS, mydeposits or TDS within 30 days ([gov.uk](https://www.gov.uk/tenancy-deposit-protection); [TDS](https://custodial.tenancydepositscheme.com/tools-and-guides/faqs/landlords-and-agents/what-do-i-need-to-do-when-i-receive-a-tenancy-deposit/)). Deposits are also capped at five weeks' rent, or six if annual rent exceeds £50,000 ([Citizens Advice](https://www.citizensadvice.org.uk/housing/deposits/check-your-landlord-has-protected-your-deposit/)). **A NEAR contract is not an authorised scheme.** In the UK, FairNest could not legally hold these deposits unless it partners with an authorised scheme (for example, as a front end or evidence layer) or becomes one. Citizens Advice lists categories that do not need protection, such as excluded occupiers, but these are narrow.
- **US.** Deposit law is set state by state. Massachusetts' bank-account rule shows that smart-contract custody cannot satisfy every state. A state-by-state legal review is needed before any US pilot.
- **India.** The Model Tenancy Act is a template that each state must enact; it does not apply everywhere automatically ([PRS India](https://prsindia.org/billtrack/the-model-tenancy-act-2021)).
- **Stablecoins.** Holding third-party funds in stablecoins may trigger money-transmission or e-money rules depending on the jurisdiction. This has not been assessed.

## 6. Infrastructure cost (from NEAR docs)

- **Storage.** Storage staking is "1E19 yoctoNEAR per byte, or 100kb per NEAR token" ([NEAR docs](https://docs.near.org/protocol/storage/storage-staking)). A lease record is bounded by input caps; the worst case is about 10 KB ([AUDIT.md F-1](AUDIT.md)), which by our arithmetic needs about 0.1 NEAR. That is the flat storage deposit charged per lease, and typical leases are far smaller.
- **Gas.** The gas price has a floor of 1 Tgas = 0.0001 NEAR, and a plain NEAR transfer costs 0.000045 NEAR ([NEAR docs](https://docs.near.org/protocol/transactions/gas)). FairNest's scripts prepay 100 Tgas per call. If a call burned all of it, the cost would be at most 0.01 NEAR at the floor price. Actual gas burned per call has not been measured.
- **Currency.** All costs are given in NEAR. Fiat cost depends on the NEAR price.

## 7. Defensibility and risks

**Defensibility is limited.** The contract is MIT-licensed and can be copied. Any lasting edge would have to come from operator integrations, an arbiter network, and a record of fair outcomes, none of which exist yet.

**Risks:**

- **Free incumbents.** UK schemes already offer free custody and free adjudication, so price is not a lever there.
- **Dispute adjudication is a minority event.** Formal disputes run at about 1% of deposits. Most of the value would have to come from custody and fast payout of undisputed lines.
- **Regulation.** The UK requires authorisation; US states set custody rules; stablecoin rules are unassessed.
- **Crypto adoption.** Most landlords and tenants do not hold NEAR or stablecoins.
- **Arbiter quality and neutrality.** Any account can be the arbiter, so whether a ruling is fair depends on who the parties pick.
- **Smart-contract risk.** One internal security review exists ([AUDIT.md](AUDIT.md)), but there has been no external audit and no mainnet hardening yet.
- **Evidence off-chain.** Hashes prove evidence was not changed after filing, not that it is truthful.
