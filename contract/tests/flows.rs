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
    call(&w.arbiter, &w, "finalize", json!({ "lease_id": b.to_string() })).await?.into_result()?;
    assert_eq!(balance(&w, &w.landlord, None).await?, 1000);
    println!("b) tenant silent past response window -> claim stands");

    // c) arbiter never rules -> disputed sum to tenant
    let c = create(&w, None, d.as_yoctonear(), now_secs(&w).await?, win).await?;
    fund(c).await?.into_result()?;
    call(&w.landlord, &w, "file_claim",
        json!({ "lease_id": c.to_string(), "lines": [line("Door", 500)] })).await?.into_result()?;
    call(&w.tenant, &w, "dispute",
        json!({ "lease_id": c.to_string(), "lines": [0], "reason": "not me" })).await?.into_result()?;
    wait(&w, win).await?;
    call(&w.landlord, &w, "finalize", json!({ "lease_id": c.to_string() })).await?.into_result()?;
    let l = lease(&w, c).await?;
    assert_eq!(l["to_tenant"], d.as_yoctonear().to_string());
    assert_eq!(l["history"].as_array().unwrap().last().unwrap()["kind"], "timeout_arbiter_silent");
    println!("c) arbiter silent past arbiter window -> disputed sum to tenant");
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
    Ok(())
}
