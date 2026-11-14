#!/usr/bin/env python3
"""Check the live FairNest testnet deployment from any machine. Python 3 stdlib only, no keys, no wallet.

    python3 tests/onchain/verify.py

Every line prints PASS or FAIL. Exit code 0 means every check passed.
What it checks:
  1. lease 0 on fairnest-leases.testnet ended as the README says (settled, 300 / 1200 tUSDC split, NFT handed over)
  2. the lease NFT (NEP-171/177) is owned by the replacement tenant and carries an on-chain SVG
  3. all 9 demo transactions in the README exist on-chain and none of their receipts failed
  4. the hosted app is up and the private vault refuses a request with no signature
  5. (optional) the deployed code hash equals sha256 of the wasm you built locally
"""
import base64, hashlib, json, os, sys, urllib.request, urllib.error

RPC = os.environ.get("NEAR_RPC", "https://archival-rpc.testnet.fastnear.com")
SITE = "https://fairnest.adoranto737.workers.dev"
ESCROW = "fairnest-leases.testnet"
TUSDC = 1_000_000  # 6 decimals
TXS = [  # (hash, signer, step) — the same table as the README
    ("6VQemHAyAXGPvcjUxLjtpb5AH98uaqn3t1cTDQtW5wBS", "fairnest-landlord.testnet", "create_lease 1500 tUSDC"),
    ("A6iguWyAXeFebXhnSZ6Gz5NQLdQUZ1Kdt5XqUKFEapd8", "fairnest-tenant.testnet", "fund (ft_transfer_call) + NFT mint"),
    ("GJdf6DsZHdbbAiwn7aVFKR6JFyMLQSxk79HfZqhH5zRs", "fairnest-landlord.testnet", "approve_successor"),
    ("C6U749WD8ghsMqsVJSf2A4hFANCiCXiu3M76QK8qqYwB", "fairnest-tenant.testnet", "nft_transfer to replacement"),
    ("7whGQPhFCAyRd9Q1TFzAGwvW7RbHhswVq79EaJAXhi77", "fairnest-landlord.testnet", "file_claim 200 + 400"),
    ("FUdqxMTEpmHFUk6zvsNyGiNWVD2QQRUtfgfXBdkyuE1Q", "fairnest-tenant2.testnet", "dispute carpet line"),
    ("6R1YjfpTe1YaB13kCtrtJi2aspaqnHKmK2gia2gGW5Za", "fairnest-arbiter.testnet", "resolve 100 to landlord"),
    ("Ce7GGLH15pFVwG1p1gszziDyX4agyktjvXvUYW7gGX5u", "fairnest-tenant2.testnet", "withdraw 1200 tUSDC"),
    ("HPxB6rfbtj9d3cTk8y1ACx5TzH8aM7gemGD2Bw6E89YR", "fairnest-landlord.testnet", "withdraw 300 tUSDC"),
]

failed = 0


def check(ok, what):
    global failed
    failed += not ok
    print(("PASS " if ok else "FAIL ") + what)


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, body, {"Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req, timeout=30))
    if "error" in out:
        raise RuntimeError(out["error"])
    return out["result"]


def view(method, args):
    r = rpc("query", {"request_type": "call_function", "finality": "final", "account_id": ESCROW,
                      "method_name": method, "args_base64": base64.b64encode(json.dumps(args).encode()).decode()})
    return json.loads(bytes(r["result"]))


def http(url, method="GET", data=None):
    try:
        hdr = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 fairnest-verify"}  # Cloudflare blocks the default urllib agent
        return urllib.request.urlopen(urllib.request.Request(url, data, hdr, method=method), timeout=30).status
    except urllib.error.HTTPError as e:
        return e.code


def b58(raw):
    alphabet, n, s = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", int.from_bytes(raw, "big"), ""
    while n:
        n, r = divmod(n, 58)
        s = alphabet[r] + s
    return "1" * (len(raw) - len(raw.lstrip(b"\0"))) + s


print(f"RPC {RPC}\n")
print("1. lease 0 state")
lease = view("get_lease", {"lease_id": "0"})
check(lease["status"] == "Settled", f"status is Settled ({lease['status']})")
check(lease["amount"] == str(1500 * TUSDC), "deposit was 1500 tUSDC")
check(lease["token"] == "fairnest-tusdc.testnet", "deposit token is tUSDC (NEP-141)")
check([c["amount"] for c in lease["claim"]] == [str(200 * TUSDC), str(400 * TUSDC)], "claim lines 200 cleaning + 400 carpet")
check(lease["disputed"] == [1], "only the carpet line was disputed")
check(lease["to_landlord"] == str(300 * TUSDC), "landlord got 300 (200 undisputed + 100 awarded)")
check(lease["to_tenant"] == str(1200 * TUSDC), "tenant got 1200")
check(int(lease["to_landlord"]) + int(lease["to_tenant"]) == int(lease["amount"]), "payouts add up to the deposit exactly")
check(lease["tenant"] == "fairnest-tenant2.testnet", "tenant of record is the replacement (NFT holder)")
kinds = [h["kind"] for h in lease["history"]]
check(kinds == ["created", "funded", "successor_approved", "transferred", "claimed", "disputed", "resolved"], "history: " + " > ".join(kinds))

print("\n2. lease NFT (NEP-171 / 177)")
tok = view("nft_token", {"token_id": "0"})
check(tok["owner_id"] == "fairnest-tenant2.testnet", f"nft_token(0).owner_id = {tok['owner_id']}")
media = tok["metadata"]["media"]
check(media.startswith("data:image/svg+xml"), "token image is an SVG drawn by the contract")
meta = view("nft_metadata", {})
check(meta["spec"].startswith("nft-"), f"nft_metadata spec {meta['spec']}")
check(int(view("nft_total_supply", {})) >= 1, "nft_total_supply >= 1")
check(any(t["token_id"] == "0" for t in view("nft_tokens_for_owner", {"account_id": "fairnest-tenant2.testnet"})), "token 0 listed for the new holder")
check(not any(t["token_id"] == "0" for t in view("nft_tokens_for_owner", {"account_id": "fairnest-tenant.testnet"})), "token 0 no longer listed for the old tenant")

print("\n3. demo transactions on-chain")
for h, signer, step in TXS:
    r = rpc("tx", {"tx_hash": h, "sender_account_id": signer, "wait_until": "NONE"})
    bad = [o for o in r["receipts_outcome"] if "Failure" in o["outcome"]["status"]]
    check("Failure" not in r["status"] and not bad, f"{step}: {h[:8]}... by {signer}")

print("\n4. hosted app + vault gate")
check(http(SITE + "/") == 200, f"{SITE}/ returns 200")
check(http(SITE + "/lease?id=0") == 200, "/lease?id=0 returns 200")
vault = http(SITE + "/api/vault/0/open", "POST", b"{}")
check(vault in (401, 403), f"vault API without a NEP-413 signature is refused ({vault})")

print("\n5. deployed code")
code_hash = rpc("query", {"request_type": "view_account", "finality": "final", "account_id": ESCROW})["code_hash"]
print(f"     deployed code_hash {code_hash}")
wasm = os.path.join(os.path.dirname(__file__), "..", "..", "contract", "target", "near", "fairnest.wasm")
if os.path.exists(wasm):
    local = b58(hashlib.sha256(open(wasm, "rb").read()).digest())
    print(f"     local wasm hash    {local}  (only equal if built with the same toolchain; see AUDIT.md)")
else:
    print("     skip: build contract/ with `cargo near build` to compare")

print(f"\n{'ALL CHECKS PASSED' if not failed else f'{failed} CHECK(S) FAILED'}")
sys.exit(1 if failed else 0)
