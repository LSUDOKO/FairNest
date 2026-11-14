# FairNest demo video: "Maya's deposit"

A 2½-minute story that shows every step of FairNest working on testnet, told through four people.
Each scene pairs a character card (from `characters/`) with a real screen recording of the live app:
https://fairnest.adoranto737.workers.dev

The numbers match the real testnet run in the README (lease #0, 1500 tUSDC), so every figure on screen
can be checked on the explorer.

## The cast

| | Who | Role in the story | Wallet in the demo |
|---|---|---|---|
| <img src="characters/Maya_Tenant.png" width="140"> | **Maya**, tenant | Rents the flat, locks the deposit, then moves out early for a new job | `fairnest-tenant.testnet` |
| <img src="characters/Raj_Landlord.png" width="140"> | **Raj**, landlord | Fair but careful. Approves Maya's replacement, later claims for damage | `fairnest-landlord.testnet` |
| <img src="characters/Leo_Replacement_Tenant.png" width="140"> | **Leo**, replacement tenant | Takes over Maya's lease and her deposit as an NFT | `fairnest-tenant2.testnet` |
| <img src="characters/Priya_Neutral_Arbiter.png" width="140"> | **Priya**, neutral arbiter | Only rules on the line Leo disputes, nothing else | `fairnest-arbiter.testnet` |

## Story in one line

Maya's deposit stops being "money Raj holds" and becomes an NFT she owns. When she leaves, the NFT
(and with it the refund and every tenant right) passes to Leo. At move-out Raj claims two charges, Leo
disputes one, Priya splits it fairly, and everyone withdraws exactly what the contract says.

## Scenes

Times are a guide. **VO** = voiceover, **SCREEN** = what to record, **TEXT** = caption on screen.

### 1. The problem (0:00 to 0:12)
- **Visual:** Maya card on the left, Raj card on the right, dark gap between them.
- **VO:** "Every year, renters hand over a deposit and hope. The landlord holds the money, decides the deductions alone, and pays back late, or never."
- **TEXT:** *Your deposit. Their decision.*

### 2. Meet FairNest (0:12 to 0:22)
- **SCREEN:** Landing page hero, slow scroll to the live lease NFT section.
- **VO:** "FairNest locks the deposit in a NEAR smart contract instead. Nobody holds it. The rules do."
- **TEXT:** *Deposit escrow on NEAR*

### 3. Raj creates the lease (0:22 to 0:36)
- **Visual:** Raj card slides in, bottom corner, name tag "Raj · landlord".
- **SCREEN:** Raj's wallet on `/new`: tenant `fairnest-tenant.testnet`, arbiter `fairnest-arbiter.testnet`, 1500 tUSDC, terms "12 months, 1 Main St, Apt 4". Click create, wallet confirms.
- **VO:** "Raj creates the lease: the tenant, the amount, and a neutral arbiter they both agree on, Priya."

### 4. Maya locks the deposit and gets an NFT (0:36 to 0:52)
- **Visual:** Maya card, name tag "Maya · tenant".
- **SCREEN:** Maya opens `/lease?id=0`, funds 1500 tUSDC. The lease NFT card appears, yellow "Deposit locked".
- **VO:** "Maya pays the deposit into the contract, and gets back a lease NFT. Whoever holds this token *is* the tenant: owed the refund, and the only one who can answer a claim."
- **TEXT:** *Deposit → NFT (NEP-171)*

### 5. Maya has to move (0:52 to 1:10)
- **Visual:** Maya card with a new-job caption; Leo card enters with his moving box.
- **SCREEN:** Raj's wallet: "Approve a replacement tenant" → `fairnest-tenant2.testnet`. Switch to Maya's wallet: "Hand over the lease", wallet confirms 1 yoctoNEAR. Holder line changes to Leo, holder timeline shows both.
- **VO:** "Six months in, Maya gets a job in another city. Raj approves Leo as the new tenant. Maya hands over the NFT, and the deposit and every tenant right go with it, in one transaction. No refund-and-repay, no cash changing hands."
- **TEXT:** *Only to the replacement the landlord approved*

### 6. The old holder is locked out (1:10 to 1:20)
- **SCREEN:** Maya's wallet on `/vault?id=0`: "Unlock the vault" → **Access denied**. Then Leo's wallet: unlocks, sees the move-in photos.
- **VO:** "The private inspection vault follows the NFT too. Maya's access ended the moment she handed it over. Leo's began."

### 7. Move-out: Raj files a claim (1:20 to 1:36)
- **Visual:** Raj card with clipboard.
- **SCREEN:** Raj files two lines: *Professional cleaning 200* and *Carpet replacement 400*, each with an evidence link. NFT image turns cream "Move-out claim".
- **VO:** "At move-out, Raj itemises: 200 for cleaning, 400 for a new carpet, each with evidence. The NFT is now frozen, so the payout can't be split between two holders."

### 8. Leo disputes one line (1:36 to 1:50)
- **Visual:** Leo card.
- **SCREEN:** Leo ticks only the carpet line, reason "Carpet was 8 years old, normal wear", submits. Cleaning is paid out at once, NFT turns blue "In dispute".
- **VO:** "Leo agrees the flat needed cleaning, so that part pays out right away. But the carpet was eight years old. He disputes just that line."

### 9. Priya rules (1:50 to 2:05)
- **Visual:** Priya card with the tablet of two photos.
- **SCREEN:** Priya's wallet opens the vault (allowed only while the dispute is open), then resolves: 100 to the landlord, note "Depreciated value of an 8 year old carpet".
- **VO:** "Priya sees only the disputed line and the photos. She rules that an old carpet is worth 100, not 400. And if she never answered, the money would go back to the tenant by default."
- **TEXT:** *Arbiter decides only what is disputed*

### 10. Everyone gets paid (2:05 to 2:20)
- **SCREEN:** Leo withdraws **1200 tUSDC**, Raj withdraws **300 tUSDC**. Lease shows "Settled", NFT turns dark "Closed". Quick cut to the explorer transactions.
- **VO:** "Leo withdraws 1200. Raj withdraws 300. Every step is on-chain and anyone can check it."
- **TEXT:** *1500 = 1200 to Leo + 300 to Raj*

### 11. Close (2:20 to 2:30)
- **Visual:** All four cards side by side.
- **SCREEN:** `/profile` rental record page, then the logo.
- **VO:** "Deposits that follow the tenant, deductions that need evidence, and timeouts so nobody can stall. FairNest. Fair deposits, on NEAR."
- **TEXT:** *fairnest.adoranto737.workers.dev*

## Recording checklist
- Four browser profiles (or wallets), one per character, so switching is a clean cut.
- Record each scene separately, then cut in order. Keep the character card in a corner while that person acts.
- Use a fresh lease for the recording; the numbers above are the same ones `scripts/demo.sh` uses.
- The timeouts (no claim, no answer, silent arbiter) can be shown as a single caption in scene 9 rather than recorded.
