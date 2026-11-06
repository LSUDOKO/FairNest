//! FairNest: rent security-deposit escrow.
//!
//! Flow: landlord creates a lease -> tenant funds the deposit (native NEAR or a NEP-141 token)
//! -> after lease end the landlord files itemised deductions with evidence
//! -> tenant accepts, or disputes specific lines -> arbiter rules only on disputed lines.
//! Timeouts (per lease, in seconds) stop either side from stalling:
//!   * landlord files no claim within `claim_window` after lease end -> full refund to tenant
//!   * tenant does not answer within `response_window`               -> claim stands
//!   * arbiter does not rule within `arbiter_window`                 -> disputed sum to tenant
//! Payouts are pull-based: settlement credits `balances`, `withdraw` moves the tokens and
//! restores the balance if the transfer fails, so funds can never get stuck in a failed promise.
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::{self, json};
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseError, PromiseOrValue,
};

/// Flat storage deposit per lease. Record size is bounded by the limits below (~7 KB max).
// ponytail: flat fee instead of exact metering; switch to measured storage if limits grow.
pub const STORAGE_DEPOSIT: NearToken = NearToken::from_millinear(100);
pub const MAX_LINES: usize = 10;
pub const MAX_TEXT: usize = 300;
const GAS_FT_TRANSFER: Gas = Gas::from_tgas(10);
const GAS_CALLBACK: Gas = Gas::from_tgas(10);

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Leases,
    ByAccount,
    Balances,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Status {
    Created,
    Funded,
    Claimed,
    Disputed,
    Settled,
    Cancelled,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Line {
    pub reason: String,
    pub amount: U128,
    pub evidence_url: String,
    /// sha256 (hex) of the evidence file, computed client-side, so the file can be verified later.
    pub evidence_sha256: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Event {
    pub kind: String,
    pub actor: AccountId,
    pub ts: U64,
    pub note: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Lease {
    pub id: U64,
    pub landlord: AccountId,
    pub tenant: AccountId,
    pub arbiter: AccountId,
    /// None = native NEAR, Some = NEP-141 token contract.
    pub token: Option<AccountId>,
    pub amount: U128,
    /// Unix seconds.
    pub lease_end: U64,
    pub claim_window: U64,
    pub response_window: U64,
    pub arbiter_window: U64,
    pub terms: String,
    pub status: Status,
    pub claim: Vec<Line>,
    pub disputed: Vec<u32>,
    /// Unix seconds of the last state change (claim filed / dispute opened).
    pub stage_at: U64,
    pub to_landlord: U128,
    pub to_tenant: U128,
    pub history: Vec<Event>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    leases: Vector<Lease>,
    by_account: LookupMap<AccountId, Vec<u64>>,
    balances: LookupMap<(AccountId, Option<AccountId>), u128>,
}

fn now() -> u64 {
    env::block_timestamp() / 1_000_000_000
}

fn short(s: &str, what: &str) {
    require!(s.len() <= MAX_TEXT, format!("{what} longer than {MAX_TEXT} bytes"));
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            leases: Vector::new(Key::Leases),
            by_account: LookupMap::new(Key::ByAccount),
            balances: LookupMap::new(Key::Balances),
        }
    }

    // ---------- landlord ----------

    /// Landlord creates a lease. Attach STORAGE_DEPOSIT (0.1 NEAR); any excess is refunded.
    #[payable]
    #[allow(clippy::too_many_arguments)]
    pub fn create_lease(
        &mut self,
        tenant: AccountId,
        arbiter: AccountId,
        token: Option<AccountId>,
        amount: U128,
        lease_end: U64,
        claim_window: U64,
        response_window: U64,
        arbiter_window: U64,
        terms: String,
    ) -> U64 {
        let landlord = env::predecessor_account_id();
        let attached = env::attached_deposit();
        require!(attached >= STORAGE_DEPOSIT, "attach 0.1 NEAR storage deposit");
        require!(amount.0 > 0, "deposit amount must be > 0");
        require!(tenant != landlord, "tenant cannot be the landlord");
        require!(arbiter != landlord && arbiter != tenant, "arbiter must be a third party");
        require!(
            claim_window.0 > 0 && response_window.0 > 0 && arbiter_window.0 > 0,
            "windows must be > 0"
        );
        short(&terms, "terms");

        let id = self.leases.len() as u64;
        let mut lease = Lease {
            id: U64(id),
            landlord: landlord.clone(),
            tenant: tenant.clone(),
            arbiter: arbiter.clone(),
            token,
            amount,
            lease_end,
            claim_window,
            response_window,
            arbiter_window,
            terms,
            status: Status::Created,
            claim: vec![],
            disputed: vec![],
            stage_at: U64(now()),
            to_landlord: U128(0),
            to_tenant: U128(0),
            history: vec![],
        };
        log_event(&mut lease, "created", &landlord, String::new());
        self.leases.push(lease);
        for who in [landlord.clone(), tenant, arbiter] {
            let mut ids = self.by_account.get(&who).cloned().unwrap_or_default();
            ids.push(id);
            self.by_account.insert(who, ids);
        }
        let excess = attached.saturating_sub(STORAGE_DEPOSIT);
        if !excess.is_zero() {
            Promise::new(landlord).transfer(excess).detach();
        }
        U64(id)
    }

    /// Landlord cancels a lease the tenant never funded.
    pub fn cancel(&mut self, lease_id: U64) {
        let caller = env::predecessor_account_id();
        let lease = self.lease_mut(lease_id);
        require!(caller == lease.landlord, "only landlord");
        require!(lease.status == Status::Created, "already funded");
        lease.status = Status::Cancelled;
        log_event(lease, "cancelled", &caller, String::new());
    }

    /// Landlord returns the whole deposit, any time after funding and before settlement.
    pub fn release_full(&mut self, lease_id: U64) {
        let caller = env::predecessor_account_id();
        let lease = self.lease_mut(lease_id);
        require!(caller == lease.landlord, "only landlord");
        require!(lease.status == Status::Funded, "lease is not in Funded state");
        let amount = lease.amount.0;
        let lease = settle(lease, 0, amount, "released", &caller);
        self.credit_settlement(&lease);
    }

    /// Landlord files itemised deductions after the lease ends, within the claim window.
    pub fn file_claim(&mut self, lease_id: U64, lines: Vec<Line>) {
        let caller = env::predecessor_account_id();
        let lease = self.lease_mut(lease_id);
        require!(caller == lease.landlord, "only landlord");
        require!(lease.status == Status::Funded, "lease is not in Funded state");
        let t = now();
        require!(t >= lease.lease_end.0, "lease has not ended yet");
        require!(t <= lease.lease_end.0 + lease.claim_window.0, "claim window closed");
        require!(!lines.is_empty() && lines.len() <= MAX_LINES, "1 to 10 lines");
        let mut total: u128 = 0;
        for l in &lines {
            require!(l.amount.0 > 0, "line amount must be > 0");
            short(&l.reason, "reason");
            short(&l.evidence_url, "evidence_url");
            require!(
                l.evidence_sha256.is_empty() || l.evidence_sha256.len() == 64,
                "evidence_sha256 must be 64 hex chars or empty"
            );
            total = total.checked_add(l.amount.0).expect("overflow");
        }
        require!(total <= lease.amount.0, "deductions exceed the deposit");
        lease.claim = lines;
        lease.status = Status::Claimed;
        lease.stage_at = U64(t);
        log_event(lease, "claimed", &caller, total.to_string());
    }

    // ---------- tenant ----------

    /// Tenant funds a native-NEAR lease. Attach exactly `amount` yoctoNEAR.
    #[payable]
    pub fn fund_native(&mut self, lease_id: U64) {
        let caller = env::predecessor_account_id();
        let attached = env::attached_deposit().as_yoctonear();
        let lease = self.lease_mut(lease_id);
        require!(lease.token.is_none(), "this lease is funded with a token, use ft_transfer_call");
        fund(lease, &caller, attached);
    }

    /// NEP-141 receiver. msg = lease id as a string, e.g. "0".
    /// Any panic here makes the token contract refund the tenant in full.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let token = env::predecessor_account_id();
        let id: u64 = msg.trim().parse().expect("msg must be the lease id");
        let lease = self.lease_mut(U64(id));
        require!(lease.token.as_ref() == Some(&token), "wrong token for this lease");
        fund(lease, &sender_id, amount.0);
        PromiseOrValue::Value(U128(0))
    }

    /// Tenant accepts the landlord's claim in full.
    pub fn accept(&mut self, lease_id: U64) {
        let caller = env::predecessor_account_id();
        let lease = self.lease_mut(lease_id);
        require!(caller == lease.tenant, "only tenant");
        require!(lease.status == Status::Claimed, "no open claim");
        let lease = settle_claim(lease, "accepted", &caller);
        self.credit_settlement(&lease);
    }

    /// Tenant disputes specific claim lines (indexes). Undisputed lines and the unclaimed
    /// remainder settle now; only the disputed sum waits for the arbiter.
    pub fn dispute(&mut self, lease_id: U64, lines: Vec<u32>, reason: String) {
        let caller = env::predecessor_account_id();
        short(&reason, "reason");
        let lease = self.lease_mut(lease_id);
        require!(caller == lease.tenant, "only tenant");
        require!(lease.status == Status::Claimed, "no open claim");
        let mut idx = lines;
        idx.sort_unstable();
        idx.dedup();
        require!(!idx.is_empty(), "pick at least one line");
        require!(
            idx.iter().all(|i| (*i as usize) < lease.claim.len()),
            "line index out of range"
        );
        let disputed: u128 = idx.iter().map(|i| lease.claim[*i as usize].amount.0).sum();
        let claimed: u128 = lease.claim.iter().map(|l| l.amount.0).sum();
        let landlord_now = claimed - disputed;
        let tenant_now = lease.amount.0 - claimed;
        lease.disputed = idx;
        lease.status = Status::Disputed;
        lease.stage_at = U64(now());
        lease.to_landlord = U128(landlord_now);
        lease.to_tenant = U128(tenant_now);
        log_event(lease, "disputed", &caller, reason);
        let (token, landlord, tenant) =
            (lease.token.clone(), lease.landlord.clone(), lease.tenant.clone());
        self.credit(&landlord, &token, landlord_now);
        self.credit(&tenant, &token, tenant_now);
    }

    // ---------- arbiter ----------

    /// Arbiter splits the disputed sum: `to_landlord` goes to the landlord, the rest to the tenant.
    pub fn resolve(&mut self, lease_id: U64, to_landlord: U128, note: String) {
        let caller = env::predecessor_account_id();
        short(&note, "note");
        let lease = self.lease_mut(lease_id);
        require!(caller == lease.arbiter, "only arbiter");
        require!(lease.status == Status::Disputed, "no open dispute");
        let disputed = disputed_sum(lease);
        require!(to_landlord.0 <= disputed, "cannot award more than the disputed sum");
        let (token, landlord, tenant) =
            (lease.token.clone(), lease.landlord.clone(), lease.tenant.clone());
        lease.to_landlord = U128(lease.to_landlord.0 + to_landlord.0);
        lease.to_tenant = U128(lease.to_tenant.0 + disputed - to_landlord.0);
        lease.status = Status::Settled;
        log_event(lease, "resolved", &caller, note);
        self.credit(&landlord, &token, to_landlord.0);
        self.credit(&tenant, &token, disputed - to_landlord.0);
    }

    // ---------- anyone ----------

    /// Applies whichever timeout has expired. Callable by anyone.
    pub fn finalize(&mut self, lease_id: U64) {
        let caller = env::predecessor_account_id();
        let t = now();
        let lease = self.lease_mut(lease_id);
        match lease.status {
            Status::Funded => {
                require!(
                    t > lease.lease_end.0 + lease.claim_window.0,
                    "claim window still open"
                );
                let amount = lease.amount.0;
                let lease = settle(lease, 0, amount, "timeout_no_claim", &caller);
                self.credit_settlement(&lease);
            }
            Status::Claimed => {
                require!(
                    t > lease.stage_at.0 + lease.response_window.0,
                    "tenant can still respond"
                );
                let lease = settle_claim(lease, "timeout_claim_stands", &caller);
                self.credit_settlement(&lease);
            }
            Status::Disputed => {
                require!(
                    t > lease.stage_at.0 + lease.arbiter_window.0,
                    "arbiter can still rule"
                );
                let disputed = disputed_sum(lease);
                let (token, tenant) = (lease.token.clone(), lease.tenant.clone());
                lease.to_tenant = U128(lease.to_tenant.0 + disputed);
                lease.status = Status::Settled;
                log_event(lease, "timeout_arbiter_silent", &caller, String::new());
                self.credit(&tenant, &token, disputed);
            }
            _ => env::panic_str("nothing to finalize"),
        }
    }

    /// Withdraw the caller's whole balance of `token` (None = native NEAR).
    /// For tokens the caller must be storage-registered on the token contract;
    /// if the transfer fails the balance is restored.
    pub fn withdraw(&mut self, token: Option<AccountId>) -> Promise {
        let who = env::predecessor_account_id();
        let key = (who.clone(), token.clone());
        let amount = self.balances.remove(&key).unwrap_or(0);
        require!(amount > 0, "nothing to withdraw");
        let transfer = match &token {
            None => Promise::new(who.clone()).transfer(NearToken::from_yoctonear(amount)),
            Some(ft) => Promise::new(ft.clone()).function_call(
                "ft_transfer".to_string(),
                serde_json::to_vec(&json!({ "receiver_id": who, "amount": U128(amount) }))
                    .unwrap(),
                NearToken::from_yoctonear(1),
                GAS_FT_TRANSFER,
            ),
        };
        transfer.then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CALLBACK)
                .on_withdraw(who, token, U128(amount)),
        )
    }

    #[private]
    pub fn on_withdraw(
        &mut self,
        account: AccountId,
        token: Option<AccountId>,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> bool {
        if result.is_ok() {
            return true;
        }
        self.credit(&account, &token, amount.0);
        env::log_str(&format!("withdraw failed, {} restored to {}", amount.0, account));
        false
    }

    // ---------- views ----------

    pub fn get_lease(&self, lease_id: U64) -> Option<Lease> {
        self.leases.get(lease_id.0 as u32).cloned()
    }

    pub fn get_leases_for(&self, account_id: AccountId) -> Vec<Lease> {
        self.by_account
            .get(&account_id)
            .map(|ids| ids.iter().filter_map(|i| self.leases.get(*i as u32).cloned()).collect())
            .unwrap_or_default()
    }

    pub fn get_balance(&self, account_id: AccountId, token: Option<AccountId>) -> U128 {
        U128(self.balances.get(&(account_id, token)).copied().unwrap_or(0))
    }

    pub fn lease_count(&self) -> U64 {
        U64(self.leases.len() as u64)
    }

    // ---------- internal ----------

    fn lease_mut(&mut self, id: U64) -> &mut Lease {
        self.leases.get_mut(id.0 as u32).expect("lease not found")
    }

    fn credit(&mut self, who: &AccountId, token: &Option<AccountId>, amount: u128) {
        if amount == 0 {
            return;
        }
        let key = (who.clone(), token.clone());
        let bal = self.balances.get(&key).copied().unwrap_or(0);
        self.balances.insert(key, bal + amount);
    }

    fn credit_settlement(&mut self, lease: &Lease) {
        self.credit(&lease.landlord, &lease.token, lease.to_landlord.0);
        self.credit(&lease.tenant, &lease.token, lease.to_tenant.0);
    }
}

fn fund(lease: &mut Lease, sender: &AccountId, amount: u128) {
    require!(*sender == lease.tenant, "only the tenant can fund");
    require!(lease.status == Status::Created, "lease is not awaiting funds");
    require!(amount == lease.amount.0, "must deposit the exact amount");
    lease.status = Status::Funded;
    log_event(lease, "funded", sender, amount.to_string());
}

fn disputed_sum(lease: &Lease) -> u128 {
    lease.disputed.iter().map(|i| lease.claim[*i as usize].amount.0).sum()
}

/// Settles the whole claim as filed. Returns a copy for crediting (borrow of self ends).
fn settle_claim(lease: &mut Lease, kind: &str, actor: &AccountId) -> Lease {
    let claimed: u128 = lease.claim.iter().map(|l| l.amount.0).sum();
    let rest = lease.amount.0 - claimed;
    settle(lease, claimed, rest, kind, actor)
}

fn settle(lease: &mut Lease, to_landlord: u128, to_tenant: u128, kind: &str, actor: &AccountId) -> Lease {
    lease.to_landlord = U128(to_landlord);
    lease.to_tenant = U128(to_tenant);
    lease.status = Status::Settled;
    log_event(lease, kind, actor, String::new());
    lease.clone()
}

/// Appends to the on-chain timeline and emits a NEP-297 event log.
fn log_event(lease: &mut Lease, kind: &str, actor: &AccountId, note: String) {
    let ts = now();
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({
            "standard": "fairnest",
            "version": "1.0.0",
            "event": kind,
            "data": [{ "lease_id": lease.id, "actor": actor, "note": note }]
        })
    ));
    lease.history.push(Event { kind: kind.to_string(), actor: actor.clone(), ts: U64(ts), note });
}
