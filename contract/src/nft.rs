//! NEP-171 core + NEP-177 metadata + NEP-181 enumeration for lease deposit NFTs.
//!
//! Token id = lease id. The token exists once the tenant funds the lease and is owned by
//! `lease.tenant`; there is no separate owner map that could drift out of sync.
//!
//! Transfer rules (enforced in `transfer`):
//!   * only the current holder can move it, with exactly 1 yoctoNEAR (wallet confirmation);
//!   * only while the lease is `Funded`: once a claim is filed the token is frozen, so a
//!     payout can never be split between an old and a new holder;
//!   * only to the replacement tenant the landlord approved with `approve_successor`;
//!   * no NEP-178 approvals: no operator or marketplace can ever move it on the holder's behalf.
//!
//! Metadata is computed at view time from the lease, so the image follows the lease stage.
use crate::*;

const GAS_ON_TRANSFER: Gas = Gas::from_tgas(25);
const GAS_RESOLVE: Gas = Gas::from_tgas(15);

#[near(serializers = [json])]
pub struct NftContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [json])]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<String>,
    pub copies: Option<U64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [json])]
pub struct Token {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: Option<TokenMetadata>,
    pub approved_account_ids: std::collections::HashMap<AccountId, u64>,
}

/// Emits a NEP-297 event under the NEP-171 standard so wallets and explorers index the token.
pub(crate) fn emit(event: &str, data: serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({ "standard": "nep171", "version": "1.2.0", "event": event, "data": data })
    ));
}

fn minted(lease: &Lease) -> bool {
    !matches!(lease.status, Status::Created | Status::Cancelled)
}

fn parse_id(token_id: &str) -> U64 {
    U64(token_id.parse().expect("token_id must be a lease id"))
}

#[near]
impl Contract {
    // ---------- NEP-171 core ----------

    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        near_sdk::assert_one_yocto();
        require!(approval_id.is_none(), "approvals are not supported");
        let sender = env::predecessor_account_id();
        self.transfer(&sender, &receiver_id, &token_id, memo);
    }

    #[payable]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> Promise {
        near_sdk::assert_one_yocto();
        require!(approval_id.is_none(), "approvals are not supported");
        let sender = env::predecessor_account_id();
        self.transfer(&sender, &receiver_id, &token_id, memo);
        Promise::new(receiver_id.clone())
            .function_call(
                "nft_on_transfer".to_string(),
                serde_json::to_vec(&json!({
                    "sender_id": sender,
                    "previous_owner_id": sender,
                    "token_id": token_id,
                    "msg": msg,
                }))
                .unwrap(),
                NearToken::from_yoctonear(0),
                GAS_ON_TRANSFER,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_RESOLVE)
                    .nft_resolve_transfer(sender, receiver_id, token_id, None),
            )
    }

    /// Returns true if the token stayed with the receiver.
    /// The token goes back only if the receiver asked for it (or its call failed) AND the
    /// receiver still holds it AND the lease is still `Funded`: a receiver cannot act on the
    /// lease during the callback window and then hand the token back.
    #[private]
    pub fn nft_resolve_transfer(
        &mut self,
        owner_id: AccountId,
        receiver_id: AccountId,
        token_id: String,
        approved_account_ids: Option<std::collections::HashMap<AccountId, u64>>,
        #[callback_result] must_return: Result<bool, PromiseError>,
    ) -> bool {
        let _ = approved_account_ids;
        if !must_return.unwrap_or(true) {
            return true;
        }
        let lease = self.lease_mut(parse_id(&token_id));
        if lease.tenant != receiver_id || lease.status != Status::Funded {
            return true;
        }
        lease.tenant = owner_id.clone();
        log_event(lease, "transfer_returned", &receiver_id, owner_id.to_string());
        emit(
            "nft_transfer",
            json!([{ "old_owner_id": receiver_id, "new_owner_id": owner_id, "token_ids": [token_id] }]),
        );
        false
    }

    pub fn nft_token(&self, token_id: String) -> Option<Token> {
        let id: u64 = token_id.parse().ok()?;
        let lease = self.leases.get(id as u32)?;
        minted(lease).then(|| token(lease))
    }

    // ---------- NEP-177 metadata ----------

    pub fn nft_metadata(&self) -> NftContractMetadata {
        NftContractMetadata {
            spec: "nft-1.0.0".into(),
            name: "FairNest Lease Deposits".into(),
            symbol: "FNLEASE".into(),
            icon: Some(svg_uri(&icon_svg())),
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    // ---------- NEP-181 enumeration ----------

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.minted as u128)
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        let start = from_index.map(|i| i.0 as usize).unwrap_or(0);
        self.leases
            .iter()
            .filter(|l| minted(l))
            .skip(start)
            .take(limit.unwrap_or(50) as usize)
            .map(token)
            .collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        U128(self.owned(&account_id).len() as u128)
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.owned(&account_id)
            .into_iter()
            .skip(from_index.map(|i| i.0 as usize).unwrap_or(0))
            .take(limit.unwrap_or(50) as usize)
            .collect()
    }

    // ---------- internal ----------

    fn owned(&self, account_id: &AccountId) -> Vec<Token> {
        self.get_leases_for(account_id.clone())
            .iter()
            .filter(|l| minted(l) && l.tenant == *account_id)
            .map(token)
            .collect()
    }

    /// Moves the deposit position. Everything tenant-side (refund rights, actions, gated
    /// access) follows `lease.tenant`, so the sender loses it in this same receipt.
    fn transfer(&mut self, sender: &AccountId, receiver: &AccountId, token_id: &str, memo: Option<String>) {
        let id = parse_id(token_id);
        let lease = self.lease_mut(id);
        require!(minted(lease), "token does not exist");
        require!(*sender == lease.tenant, "only the holder can transfer this lease");
        require!(
            lease.status == Status::Funded,
            "the deposit is frozen once a claim is filed or the lease is settled"
        );
        require!(
            lease.successor.as_ref() == Some(receiver),
            "receiver must be the replacement tenant the landlord approved"
        );
        lease.tenant = receiver.clone();
        lease.successor = None;
        log_event(lease, "transferred", sender, receiver.to_string());
        let mut data = json!({ "old_owner_id": sender, "new_owner_id": receiver, "token_ids": [token_id] });
        if let Some(m) = memo {
            data["memo"] = json!(m);
        }
        emit("nft_transfer", json!([data]));
        self.index(receiver, id.0);
    }
}

fn token(lease: &Lease) -> Token {
    let (label, fill, ink) = match lease.status {
        Status::Funded => ("Deposit locked", "#f3df1d", "#16172f"),
        Status::Claimed => ("Move-out claim", "#f0eee4", "#16172f"),
        Status::Disputed => ("In dispute", "#3242e6", "#f0eee4"),
        _ => ("Closed", "#16172f", "#f3df1d"),
    };
    let amount = crate::fmt_amount(lease.amount.0, lease.token.is_some());
    let svg = format!(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>\
<rect width='400' height='400' fill='#0b0a06'/>\
<circle cx='200' cy='170' r='150' fill='{fill}'/>\
<text x='200' y='120' text-anchor='middle' font-family='sans-serif' font-size='22' fill='{ink}'>FairNest lease</text>\
<text x='200' y='190' text-anchor='middle' font-family='sans-serif' font-size='64' font-weight='700' fill='{ink}'>#{id}</text>\
<text x='200' y='240' text-anchor='middle' font-family='sans-serif' font-size='24' fill='{ink}'>{amount}</text>\
<text x='200' y='370' text-anchor='middle' font-family='monospace' font-size='22' fill='#f0eee4'>{label}</text>\
</svg>",
        id = lease.id.0
    );
    Token {
        token_id: lease.id.0.to_string(),
        owner_id: lease.tenant.clone(),
        metadata: Some(TokenMetadata {
            title: Some(format!("FairNest lease #{}", lease.id.0)),
            description: Some(format!(
                "Rent deposit of {amount} held in escrow. The holder is the tenant: owed the refund and the only account that can answer claims. Status: {label}."
            )),
            media: Some(svg_uri(&svg)),
            media_hash: None,
            copies: Some(U64(1)),
            issued_at: lease.history.iter().find(|e| e.kind == "funded").map(|e| (e.ts.0 * 1000).to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: lease.history.last().map(|e| (e.ts.0 * 1000).to_string()),
            extra: Some(
                json!({ "status": lease.status, "landlord": lease.landlord, "arbiter": lease.arbiter, "amount": lease.amount, "token": lease.token })
                    .to_string(),
            ),
            reference: None,
            reference_hash: None,
        }),
        approved_account_ids: Default::default(),
    }
}

fn icon_svg() -> String {
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect width='48' height='48' rx='12' fill='#0b0a06'/>\
<path d='M10 24 L24 12 L38 24' stroke='#f3df1d' stroke-width='7' stroke-linecap='round' stroke-linejoin='round' fill='none'/>\
<circle cx='24' cy='34' r='5' fill='#f3df1d'/></svg>"
        .to_string()
}

/// Percent-encodes an SVG into a data URI that every browser renders in an <img>.
fn svg_uri(svg: &str) -> String {
    let mut out = String::from("data:image/svg+xml,");
    for b in svg.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.~/=:',".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}
