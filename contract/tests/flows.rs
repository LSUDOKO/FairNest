//! End-to-end FairNest flows on a local NEAR sandbox. No account or funds needed:
//!     cd contract && cargo test -- --nocapture
//! Each test prints the steps it runs, so the output doubles as a demo.
use near_workspaces::network::Sandbox;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract, Worker};
use serde_json::{json, Value};

type R<T = ()> = Result<T, Box<dyn std::error::Error>>;

const TUSDC: u128 = 1_000_000; // 6 decimals

struct World {
    worker: Worker<Sandbox>,
    escrow: Contract,
    landlord: Account,
    tenant: Account,
    arbiter: Account,
}

async fn world() -> R<World> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = near_workspaces::compile_project("./").await?;
    let escrow = worker.dev_deploy(&wasm).await?;
    escrow.call("new").transact().await?.into_result()?;
    let landlord = worker.dev_create_account().await?;
    let tenant = worker.dev_create_account().await?;
    let arbiter = worker.dev_create_account().await?;
    Ok(World { worker, escrow, landlord, tenant, arbiter })
}

async fn token(w: &World) -> R<Contract> {
    let wasm = near_workspaces::compile_project("../test-token").await?;
    let t = w.worker.dev_deploy(&wasm).await?;
    t.call("new").transact().await?.into_result()?;
    Ok(t)
}

async fn now_secs(w: &World) -> R<u64> {
    Ok(w.worker.view_block().await?.timestamp() / 1_000_000_000)
}

/// Advances sandbox time until `secs` seconds have passed.
async fn wait(w: &World, secs: u64) -> R {
    let target = now_secs(w).await? + secs + 1;
    while now_secs(w).await? <= target {
        w.worker.fast_forward(50).await?;
    }
    Ok(())
}

async fn create(w: &World, token: Option<&str>, amount: u128, lease_end: u64, windows: u64) -> R<u64> {
    let id: String = w
        .landlord
        .call(w.escrow.id(), "create_lease")
        .args_json(json!({
            "tenant": w.tenant.id(), "arbiter": w.arbiter.id(), "token": token,
            "amount": amount.to_string(), "lease_end": lease_end.to_string(),
            "claim_window": windows.to_string(), "response_window": windows.to_string(),
            "arbiter_window": windows.to_string(), "terms": "12 months, 1 Main St, Apt 4"
        }))
        .deposit(NearToken::from_millinear(100))
        .transact()
        .await?
        .into_result()?
        .json()?;
    Ok(id.parse()?)
}

async fn lease(w: &World, id: u64) -> R<Value> {
    Ok(w.escrow.view("get_lease").args_json(json!({ "lease_id": id.to_string() })).await?.json()?)
}

async fn balance(w: &World, who: &Account, token: Option<&str>) -> R<u128> {
    let v: String = w
        .escrow
        .view("get_balance")
        .args_json(json!({ "account_id": who.id(), "token": token }))
        .await?
        .json()?;
    Ok(v.parse()?)
}

async fn call(who: &Account, w: &World, method: &str, args: Value) -> R<near_workspaces::result::ExecutionFinalResult> {
    Ok(who.call(w.escrow.id(), method).args_json(args).max_gas().transact().await?)
}

fn line(reason: &str, amount: u128) -> Value {
    json!({ "reason": reason, "amount": amount.to_string(),
            "evidence_url": "https://example.com/photo.jpg",
            "evidence_sha256": "a".repeat(64) })
}

#[tokio::test]
async fn happy_path_native_near() -> R {
    let w = world().await?;
    let deposit = NearToken::from_near(5).as_yoctonear();
    let id = create(&w, None, deposit, now_secs(&w).await?, 600).await?;
    println!("1. landlord created lease {id} for a 5 NEAR deposit");

    let r = w.tenant.call(w.escrow.id(), "fund_native")
        .args_json(json!({ "lease_id": id.to_string() }))
        .deposit(NearToken::from_near(5)).transact().await?;
    assert!(r.is_success(), "{r:?}");
    println!("2. tenant funded it, status = {}", lease(&w, id).await?["status"]);

    let one = NearToken::from_near(1).as_yoctonear();
    call(&w.landlord, &w, "file_claim", json!({ "lease_id": id.to_string(),
        "lines": [line("Broken blinds", one), line("Deep clean", one / 2)] })).await?.into_result()?;
    println!("3. landlord filed a 1.5 NEAR claim with photo evidence");

    call(&w.tenant, &w, "accept", json!({ "lease_id": id.to_string() })).await?.into_result()?;
    assert_eq!(balance(&w, &w.landlord, None).await?, one + one / 2);
    assert_eq!(balance(&w, &w.tenant, None).await?, deposit - one - one / 2);
    println!("4. tenant accepted: landlord credited 1.5 NEAR, tenant 3.5 NEAR");

    let before = w.tenant.view_account().await?.balance;
    call(&w.tenant, &w, "withdraw", json!({ "token": null })).await?.into_result()?;
    let after = w.tenant.view_account().await?.balance;
    assert!(after.as_yoctonear() > before.as_yoctonear() + 3 * one);
    assert_eq!(balance(&w, &w.tenant, None).await?, 0);
    println!("5. tenant withdrew 3.5 NEAR to their wallet");
    assert_eq!(lease(&w, id).await?["status"], "Settled");
    Ok(())
}

#[tokio::test]
async fn partial_dispute_with_token_and_arbiter() -> R {
    let w = world().await?;
    let t = token(&w).await?;
    let tid = t.id().as_str();
    let id = create(&w, Some(tid), 1000 * TUSDC, now_secs(&w).await?, 600).await?;
    println!("1. landlord created lease {id} for 1000 tUSDC");

    w.tenant.call(t.id(), "mint").args_json(json!({ "amount": (1000 * TUSDC).to_string() }))
        .transact().await?.into_result()?;
    w.escrow.as_account().call(t.id(), "storage_deposit").args_json(json!({}))
        .deposit(NearToken::from_millinear(10)).transact().await?.into_result()?;
    w.tenant.call(t.id(), "ft_transfer_call")
        .args_json(json!({ "receiver_id": w.escrow.id(), "amount": (1000 * TUSDC).to_string(), "msg": id.to_string() }))
        .deposit(NearToken::from_yoctonear(1)).max_gas().transact().await?.into_result()?;
    assert_eq!(lease(&w, id).await?["status"], "Funded");
    println!("2. tenant funded it with ft_transfer_call");

    call(&w.landlord, &w, "file_claim", json!({ "lease_id": id.to_string(),
        "lines": [line("Repaint wall", 100 * TUSDC), line("New carpet", 300 * TUSDC)] })).await?.into_result()?;
    println!("3. landlord claimed 100 (paint) + 300 (carpet)");

    call(&w.tenant, &w, "dispute", json!({ "lease_id": id.to_string(), "lines": [1],
        "reason": "Carpet was already worn at move-in, see inventory photo" })).await?.into_result()?;
    assert_eq!(balance(&w, &w.landlord, Some(tid)).await?, 100 * TUSDC);
    assert_eq!(balance(&w, &w.tenant, Some(tid)).await?, 600 * TUSDC);
    println!("4. tenant disputed the carpet only: paint 100 -> landlord, 600 -> tenant right away, 300 held");

    let r = call(&w.landlord, &w, "resolve", json!({ "lease_id": id.to_string(), "to_landlord": "1", "note": "" })).await?;
    assert!(r.is_failure(), "landlord must not be able to resolve");
    call(&w.arbiter, &w, "resolve", json!({ "lease_id": id.to_string(),
        "to_landlord": (100 * TUSDC).to_string(), "note": "Fair wear: landlord gets 1/3" })).await?.into_result()?;
    assert_eq!(balance(&w, &w.landlord, Some(tid)).await?, 200 * TUSDC);
    assert_eq!(balance(&w, &w.tenant, Some(tid)).await?, 800 * TUSDC);
    println!("5. arbiter split the 300: landlord 200 total, tenant 800 total");

    // Landlord never registered with the token: the transfer fails and the balance comes back.
    let _failed_on_purpose = call(&w.landlord, &w, "withdraw", json!({ "token": tid })).await?;
    assert_eq!(balance(&w, &w.landlord, Some(tid)).await?, 200 * TUSDC);
    println!("6. landlord withdraw failed (not registered on token), balance restored");
    w.landlord.call(t.id(), "storage_deposit").args_json(json!({}))
        .deposit(NearToken::from_millinear(10)).transact().await?.into_result()?;
    call(&w.landlord, &w, "withdraw", json!({ "token": tid })).await?.into_result()?;
    let got: String = t.view("ft_balance_of").args_json(json!({ "account_id": w.landlord.id() })).await?.json()?;
    assert_eq!(got, (200 * TUSDC).to_string());
    println!("7. after storage_deposit, landlord withdrew 200 tUSDC");
    Ok(())
}

#[tokio::test]
async fn timeouts_protect_both_sides() -> R {
    let w = world().await?;
    let d = NearToken::from_near(2);
    let win = 5;
    let fund = |id: u64| {
        w.tenant.call(w.escrow.id(), "fund_native")
            .args_json(json!({ "lease_id": id.to_string() })).deposit(d).transact()
    };

    // a) landlord never files a claim -> full refund
    let a = create(&w, None, d.as_yoctonear(), now_secs(&w).await?, win).await?;
    fund(a).await?.into_result()?;
    assert!(call(&w.arbiter, &w, "finalize", json!({ "lease_id": a.to_string() })).await?.is_failure());
    wait(&w, win).await?;
    call(&w.arbiter, &w, "finalize", json!({ "lease_id": a.to_string() })).await?.into_result()?;
    assert_eq!(balance(&w, &w.tenant, None).await?, d.as_yoctonear());
    println!("a) landlord silent past claim window -> tenant refunded in full");
    let r = call(&w.landlord, &w, "file_claim",
        json!({ "lease_id": a.to_string(), "lines": [line("late", 1)] })).await?;
    assert!(r.is_failure(), "claim after settlement must fail");

    // b) tenant ignores the claim -> claim stands
    let b = create(&w, None, d.as_yoctonear(), now_secs(&w).await?, 600).await?;
    fund(b).await?.into_result()?;
    call(&w.landlord, &w, "file_claim",
        json!({ "lease_id": b.to_string(), "lines": [line("Oven", 1000)] })).await?.into_result()?;
    // b uses a 600s response window; fast-forward sandbox time past it.
    wait(&w, 600).await?;
    let r = call(&w.tenant, &w, "dispute",
        json!({ "lease_id": b.to_string(), "lines": [0], "reason": "too late" })).await?;
    assert!(r.is_failure(), "dispute after the response window must fail");
    assert!(call(&w.tenant, &w, "accept", json!({ "lease_id": b.to_string() })).await?.is_failure());
    call(&w.arbiter, &w, "finalize", json!({ "lease_id": b.to_string() })).await?.into_result()?;
    assert_eq!(balance(&w, &w.landlord, None).await?, 1000);
    println!("b) tenant silent past response window -> claim stands (late dispute and accept rejected)");

    // c) arbiter never rules -> disputed sum to tenant
    let c = create(&w, None, d.as_yoctonear(), now_secs(&w).await?, win).await?;
    fund(c).await?.into_result()?;
    call(&w.landlord, &w, "file_claim",
        json!({ "lease_id": c.to_string(), "lines": [line("Door", 500)] })).await?.into_result()?;
    call(&w.tenant, &w, "dispute",
        json!({ "lease_id": c.to_string(), "lines": [0], "reason": "not me" })).await?.into_result()?;
    wait(&w, win).await?;
    let r = call(&w.arbiter, &w, "resolve",
        json!({ "lease_id": c.to_string(), "to_landlord": "500", "note": "too late" })).await?;
    assert!(r.is_failure(), "ruling after the arbiter window must fail");
    call(&w.landlord, &w, "finalize", json!({ "lease_id": c.to_string() })).await?.into_result()?;
    let l = lease(&w, c).await?;
    assert_eq!(l["to_tenant"], d.as_yoctonear().to_string());
    assert_eq!(l["history"].as_array().unwrap().last().unwrap()["kind"], "timeout_arbiter_silent");
    println!("c) arbiter silent past arbiter window -> disputed sum to tenant (late ruling rejected)");
    Ok(())
}

#[tokio::test]
async fn guards_reject_bad_input() -> R {
    let w = world().await?;
    let t = token(&w).await?;
    let d = NearToken::from_near(1);
    let id = create(&w, None, d.as_yoctonear(), now_secs(&w).await?, 600).await?;

    let r = w.landlord.call(w.escrow.id(), "fund_native")
        .args_json(json!({ "lease_id": id.to_string() })).deposit(d).transact().await?;
    assert!(r.is_failure(), "only tenant funds");
    let r = w.tenant.call(w.escrow.id(), "fund_native")
        .args_json(json!({ "lease_id": id.to_string() })).deposit(NearToken::from_millinear(500)).transact().await?;
    assert!(r.is_failure(), "exact amount only");

    // Paying a NEAR lease with a token is refunded by the token contract.
    w.tenant.call(t.id(), "mint").args_json(json!({ "amount": "1000" })).transact().await?.into_result()?;
    w.escrow.as_account().call(t.id(), "storage_deposit").args_json(json!({}))
        .deposit(NearToken::from_millinear(10)).transact().await?.into_result()?;
    let _refunded = w.tenant.call(t.id(), "ft_transfer_call")
        .args_json(json!({ "receiver_id": w.escrow.id(), "amount": "1000", "msg": id.to_string() }))
        .deposit(NearToken::from_yoctonear(1)).max_gas().transact().await?;
    let back: String = t.view("ft_balance_of").args_json(json!({ "account_id": w.tenant.id() })).await?.json()?;
    assert_eq!(back, "1000", "wrong token refunded");
    println!("guards: wrong funder, wrong amount and wrong token all rejected");

    // Claim before lease end, and claims above the deposit, are rejected.
    let future = create(&w, None, d.as_yoctonear(), now_secs(&w).await? + 100_000, 600).await?;
    w.tenant.call(w.escrow.id(), "fund_native")
        .args_json(json!({ "lease_id": future.to_string() })).deposit(d).transact().await?.into_result()?;
    let r = call(&w.landlord, &w, "file_claim",
        json!({ "lease_id": future.to_string(), "lines": [line("x", 1)] })).await?;
    assert!(r.is_failure(), "claim before lease end");
    w.tenant.call(w.escrow.id(), "fund_native")
        .args_json(json!({ "lease_id": id.to_string() })).deposit(d).transact().await?.into_result()?;
    let r = call(&w.landlord, &w, "file_claim",
        json!({ "lease_id": id.to_string(), "lines": [line("x", d.as_yoctonear() + 1)] })).await?;
    assert!(r.is_failure(), "claim above deposit");
    println!("guards: early claim and over-deposit claim rejected");

    // Deadlines longer than a year would let one side stall the deposit forever.
    let r = w.landlord.call(w.escrow.id(), "create_lease")
        .args_json(json!({
            "tenant": w.tenant.id(), "arbiter": w.arbiter.id(), "token": null, "amount": "1",
            "lease_end": now_secs(&w).await?.to_string(), "claim_window": u64::MAX.to_string(),
            "response_window": "60", "arbiter_window": "60", "terms": ""
        }))
        .deposit(NearToken::from_millinear(100)).transact().await?;
    assert!(r.is_failure(), "unbounded window must be rejected");
    println!("guards: deadline windows above 365 days rejected");

    // A landlord cannot grow a lease's history without bound by re-approving (AUDIT.md F-1).
    let mut ok = 0;
    for _ in 0..20 {
        let r = call(&w.landlord, &w, "approve_successor",
            json!({ "lease_id": future.to_string(), "successor": null })).await?;
        if r.is_failure() { break; }
        ok += 1;
    }
    assert_eq!(ok, 14, "approvals stop at 16 history events (created + funded + 14)");
    assert_eq!(lease(&w, future).await?["history"].as_array().unwrap().len(), 16);
    // Aliased ids ("05", 2^32 + n) do not reach a real lease (AUDIT.md F-5).
    let v: Value = w.escrow.view("nft_token").args_json(json!({ "token_id": format!("0{future}") })).await?.json()?;
    assert!(v.is_null(), "zero-padded token id must not resolve");
    let alias = (1u64 << 32) + future;
    let v: Value = w.escrow.view("get_lease").args_json(json!({ "lease_id": alias.to_string() })).await?.json()?;
    assert!(v.is_null(), "lease id above u32 must not wrap");
    println!("guards: history capped at 16 events, aliased lease and token ids rejected");
    Ok(())
}

async fn owner_of(w: &World, id: u64) -> R<Value> {
    let t: Value = w.escrow.view("nft_token").args_json(json!({ "token_id": id.to_string() })).await?.json()?;
    Ok(t["owner_id"].clone())
}

async fn nft_transfer(from: &Account, w: &World, to: &Account, id: u64, yocto: u128) -> R<near_workspaces::result::ExecutionFinalResult> {
    Ok(from.call(w.escrow.id(), "nft_transfer")
        .args_json(json!({ "receiver_id": to.id(), "token_id": id.to_string() }))
        .deposit(NearToken::from_yoctonear(yocto)).max_gas().transact().await?)
}

#[tokio::test]
async fn lease_nft_moves_the_deposit_and_every_tenant_right() -> R {
    let w = world().await?;
    let next = w.worker.dev_create_account().await?;
    let stranger = w.worker.dev_create_account().await?;
    let near = NearToken::from_near(1).as_yoctonear();
    let id = create(&w, None, 4 * near, now_secs(&w).await?, 600).await?;
    assert!(w.escrow.view("nft_token").args_json(json!({ "token_id": id.to_string() })).await?.json::<Value>()?.is_null());
    println!("1. unfunded lease has no NFT yet");

    w.tenant.call(w.escrow.id(), "fund_native").args_json(json!({ "lease_id": id.to_string() }))
        .deposit(NearToken::from_near(4)).transact().await?.into_result()?;
    let tok: Value = w.escrow.view("nft_token").args_json(json!({ "token_id": id.to_string() })).await?.json()?;
    assert_eq!(tok["owner_id"], w.tenant.id().as_str());
    assert!(tok["metadata"]["media"].as_str().unwrap().starts_with("data:image/svg+xml,"));
    assert!(tok["metadata"]["media"].as_str().unwrap().contains("Deposit%20locked"));
    let supply: String = w.escrow.view("nft_total_supply").await?.json()?;
    assert_eq!(supply, "1");
    println!("2. funding minted lease NFT #{id} to the tenant (image: Deposit locked)");

    assert!(nft_transfer(&w.tenant, &w, &next, id, 1).await?.is_failure(), "no approved successor yet");
    let r = call(&stranger, &w, "approve_successor", json!({ "lease_id": id.to_string(), "successor": next.id() })).await?;
    assert!(r.is_failure(), "only the landlord approves");
    call(&w.landlord, &w, "approve_successor", json!({ "lease_id": id.to_string(), "successor": next.id() })).await?.into_result()?;
    assert!(nft_transfer(&stranger, &w, &next, id, 1).await?.is_failure(), "non-holder cannot move it");
    assert!(nft_transfer(&w.tenant, &w, &stranger, id, 1).await?.is_failure(), "only to the approved successor");
    assert!(nft_transfer(&w.tenant, &w, &next, id, 0).await?.is_failure(), "needs 1 yocto");
    println!("3. blocked: no approval, non-holder, unapproved receiver, missing 1 yocto");

    nft_transfer(&w.tenant, &w, &next, id, 1).await?.into_result()?;
    assert_eq!(owner_of(&w, id).await?, next.id().as_str());
    let l = lease(&w, id).await?;
    assert_eq!(l["tenant"], next.id().as_str());
    assert!(l["successor"].is_null(), "approval is single-use");
    let mine: Vec<Value> = w.escrow.view("nft_tokens_for_owner").args_json(json!({ "account_id": w.tenant.id() })).await?.json()?;
    assert!(mine.is_empty());
    println!("4. tenant handed the lease to the approved replacement; the old tenant holds nothing");

    assert!(nft_transfer(&w.tenant, &w, &w.tenant, id, 1).await?.is_failure(), "old holder cannot pull it back");
    call(&w.landlord, &w, "file_claim", json!({ "lease_id": id.to_string(),
        "lines": [line("Scratched floor", near), line("Cleaning", near / 2)] })).await?.into_result()?;
    assert!(call(&w.tenant, &w, "accept", json!({ "lease_id": id.to_string() })).await?.is_failure());
    assert!(call(&w.tenant, &w, "dispute", json!({ "lease_id": id.to_string(), "lines": [0], "reason": "x" })).await?.is_failure());
    println!("5. after move-out claim: old tenant can neither accept nor dispute");

    let r = call(&w.landlord, &w, "approve_successor", json!({ "lease_id": id.to_string(), "successor": stranger.id() })).await?;
    assert!(r.is_failure(), "no new successor once a claim is open");
    call(&next, &w, "dispute", json!({ "lease_id": id.to_string(), "lines": [0], "reason": "Floor was scratched before I moved in" })).await?.into_result()?;
    assert_eq!(balance(&w, &next, None).await?, 4 * near - near - near / 2);
    assert!(nft_transfer(&next, &w, &stranger, id, 1).await?.is_failure(), "frozen mid-payout");
    assert!(owner_of(&w, id).await?.as_str() == Some(next.id().as_str()));
    println!("6. mid-payout: 2.5 NEAR already credited to the current holder, token frozen while the arbiter decides");

    call(&w.arbiter, &w, "resolve", json!({ "lease_id": id.to_string(), "to_landlord": (near / 4).to_string(), "note": "partial" })).await?.into_result()?;
    assert_eq!(balance(&w, &next, None).await?, 4 * near - near / 2 - near / 4);
    assert_eq!(balance(&w, &w.tenant, None).await?, 0, "old tenant is owed nothing");
    assert!(call(&w.tenant, &w, "withdraw", json!({ "token": null })).await?.is_failure());
    let tok: Value = w.escrow.view("nft_token").args_json(json!({ "token_id": id.to_string() })).await?.json()?;
    assert!(tok["metadata"]["media"].as_str().unwrap().contains("Closed"));
    let kinds: Vec<String> = lease(&w, id).await?["history"].as_array().unwrap().iter().map(|e| e["kind"].as_str().unwrap().to_string()).collect();
    assert!(kinds.contains(&"transferred".to_string()));
    println!("7. settled: replacement tenant owed 3.25 NEAR, old tenant 0; NFT image now reads Closed");
    Ok(())
}

#[tokio::test]
async fn transfer_call_to_a_non_contract_returns_the_token() -> R {
    let w = world().await?;
    let next = w.worker.dev_create_account().await?;
    let id = create(&w, None, NearToken::from_near(1).as_yoctonear(), now_secs(&w).await? + 100_000, 600).await?;
    w.tenant.call(w.escrow.id(), "fund_native").args_json(json!({ "lease_id": id.to_string() }))
        .deposit(NearToken::from_near(1)).transact().await?.into_result()?;
    call(&w.landlord, &w, "approve_successor", json!({ "lease_id": id.to_string(), "successor": next.id() })).await?.into_result()?;
    let _bounced = w.tenant.call(w.escrow.id(), "nft_transfer_call")
        .args_json(json!({ "receiver_id": next.id(), "token_id": id.to_string(), "msg": "" }))
        .deposit(NearToken::from_yoctonear(1)).max_gas().transact().await?;
    assert_eq!(owner_of(&w, id).await?, w.tenant.id().as_str());
    let kinds: Vec<String> = lease(&w, id).await?["history"].as_array().unwrap().iter().map(|e| e["kind"].as_str().unwrap().to_string()).collect();
    assert!(kinds.ends_with(&["transferred".to_string(), "transfer_returned".to_string()]));
    println!("nft_transfer_call to an account with no receiver contract: token returned to the tenant");
    Ok(())
}

/// Every role check, plus the callbacks an attacker would most like to call directly.
#[tokio::test]
async fn unauthorized_callers_are_rejected() -> R {
    let w = world().await?;
    let d = NearToken::from_near(2);
    let stranger = w.worker.dev_create_account().await?;
    let id = create(&w, None, d.as_yoctonear(), now_secs(&w).await?, 600).await?;
    let lid = json!({ "lease_id": id.to_string() });
    let fails = |r: near_workspaces::result::ExecutionFinalResult, what: &str| {
        assert!(r.is_failure(), "{what} must fail");
    };

    // Created: only the landlord may cancel; only the tenant may fund.
    fails(call(&w.tenant, &w, "cancel", lid.clone()).await?, "tenant cancel");
    fails(call(&stranger, &w, "cancel", lid.clone()).await?, "stranger cancel");
    fails(stranger.call(w.escrow.id(), "fund_native").args_json(lid.clone()).deposit(d).transact().await?, "stranger fund");
    w.tenant.call(w.escrow.id(), "fund_native").args_json(lid.clone()).deposit(d).transact().await?.into_result()?;
    println!("auth: cancel and fund are role-checked");

    // Funded: only the landlord may release, approve a successor or file a claim.
    for who in [&w.tenant, &w.arbiter, &stranger] {
        fails(call(who, &w, "release_full", lid.clone()).await?, "non-landlord release_full");
        fails(call(who, &w, "approve_successor",
            json!({ "lease_id": id.to_string(), "successor": stranger.id() })).await?, "non-landlord approve");
        fails(call(who, &w, "file_claim",
            json!({ "lease_id": id.to_string(), "lines": [line("x", 1)] })).await?, "non-landlord claim");
    }
    fails(call(&w.landlord, &w, "approve_successor",
        json!({ "lease_id": id.to_string(), "successor": w.arbiter.id() })).await?, "arbiter as successor");
    println!("auth: release_full, approve_successor and file_claim are landlord-only");

    // Claimed: only the tenant (NFT holder) may accept or dispute; the arbiter cannot rule yet.
    call(&w.landlord, &w, "file_claim",
        json!({ "lease_id": id.to_string(), "lines": [line("Paint", 1000), line("Carpet", 3000)] })).await?.into_result()?;
    for who in [&w.landlord, &w.arbiter, &stranger] {
        fails(call(who, &w, "accept", lid.clone()).await?, "non-tenant accept");
        fails(call(who, &w, "dispute",
            json!({ "lease_id": id.to_string(), "lines": [1], "reason": "x" })).await?, "non-tenant dispute");
    }
    fails(call(&w.arbiter, &w, "resolve",
        json!({ "lease_id": id.to_string(), "to_landlord": "0", "note": "" })).await?, "resolve before dispute");
    fails(call(&w.tenant, &w, "dispute",
        json!({ "lease_id": id.to_string(), "lines": [7], "reason": "x" })).await?, "dispute out-of-range line");
    fails(call(&w.tenant, &w, "dispute",
        json!({ "lease_id": id.to_string(), "lines": [], "reason": "x" })).await?, "dispute no lines");
    println!("auth: accept and dispute are tenant-only; bad line indexes rejected");

    // Disputed: only the arbiter may rule, and never above the disputed sum.
    call(&w.tenant, &w, "dispute",
        json!({ "lease_id": id.to_string(), "lines": [1, 1], "reason": "old carpet" })).await?.into_result()?;
    for who in [&w.landlord, &w.tenant, &stranger] {
        fails(call(who, &w, "resolve",
            json!({ "lease_id": id.to_string(), "to_landlord": "1000", "note": "" })).await?, "non-arbiter resolve");
    }
    fails(call(&w.arbiter, &w, "resolve",
        json!({ "lease_id": id.to_string(), "to_landlord": "3001", "note": "" })).await?, "award above disputed");
    println!("auth: resolve is arbiter-only and capped at the disputed sum (duplicate line index counted once)");

    // Private callbacks cannot be called from outside to mint a balance or steal a token.
    fails(call(&stranger, &w, "on_withdraw", json!({
        "account": stranger.id(), "token": null, "amount": d.as_yoctonear().to_string() })).await?, "external on_withdraw");
    assert_eq!(balance(&w, &stranger, None).await?, 0);
    fails(call(&stranger, &w, "nft_resolve_transfer", json!({
        "owner_id": stranger.id(), "receiver_id": w.tenant.id(), "token_id": id.to_string() })).await?, "external nft_resolve_transfer");
    // Withdrawing with nothing credited moves nothing.
    fails(call(&stranger, &w, "withdraw", json!({ "token": null })).await?, "withdraw with zero balance");
    println!("auth: private callbacks reject external callers; empty withdraw fails");

    // The arbiter rules; money is conserved exactly.
    call(&w.arbiter, &w, "resolve",
        json!({ "lease_id": id.to_string(), "to_landlord": "1000", "note": "depreciated" })).await?.into_result()?;
    let l = lease(&w, id).await?;
    let (to_l, to_t): (u128, u128) = (l["to_landlord"].as_str().unwrap().parse()?, l["to_tenant"].as_str().unwrap().parse()?);
    assert_eq!((to_l, to_t), (2000, d.as_yoctonear() - 2000));
    assert_eq!(to_l + to_t, d.as_yoctonear());
    fails(call(&w.arbiter, &w, "resolve",
        json!({ "lease_id": id.to_string(), "to_landlord": "0", "note": "" })).await?, "second ruling");
    fails(call(&w.landlord, &w, "finalize", lid.clone()).await?, "finalize after settlement");
    println!("auth: settled once, landlord 2000 + tenant rest = deposit; no second ruling or finalize");
    Ok(())
}
