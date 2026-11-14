// Live API tests for the NEP-413-gated vault (frontend/worker/index.ts) on the deployed Worker.
//
//   node --test tests/api/vault.test.mjs
//
// Each test signs a real NEP-413 message with a demo account's key from ~/.near-credentials/testnet
// (the keys `scripts/deploy.sh` creates) and checks who the Worker lets in for lease 0, which is
// settled and held by fairnest-tenant2 after fairnest-tenant handed the NFT over.
// Read-only: only `open` is called, plus one `add` with an empty body that is rejected after auth.
// Without the keys the signed tests are skipped; the unsigned test always runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const SITE = process.env.FAIRNEST_SITE ?? 'https://fairnest.adoranto737.workers.dev';
const CREDS = `${homedir()}/.near-credentials/testnet`;
const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const HEADERS = { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 fairnest-tests' };

function b58decode(s) {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(A.indexOf(c));
  const hex = n.toString(16).padStart(2, '0');
  const bytes = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
  const zeros = s.length - s.replace(/^1+/, '').length;
  return Buffer.concat([Buffer.alloc(zeros), bytes]);
}

/** NEP-413 payload, byte for byte as the Worker rebuilds it. */
function nep413(message, nonce, recipient) {
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
  const m = Buffer.from(message), r = Buffer.from(recipient);
  return Buffer.concat([u32(2 ** 31 + 413), u32(m.length), m, nonce, u32(r.length), r, Buffer.from([0])]);
}

function key(account) {
  const f = `${CREDS}/${account}.json`;
  if (!existsSync(f)) return null;
  const { public_key, private_key } = JSON.parse(readFileSync(f, 'utf8'));
  const raw = b58decode(private_key.slice(8)); // 32-byte seed + 32-byte public key
  const jwk = { kty: 'OKP', crv: 'Ed25519', d: raw.subarray(0, 32).toString('base64url'), x: raw.subarray(32).toString('base64url') };
  return { publicKey: public_key, privateKey: createPrivateKey({ key: jwk, format: 'jwk' }) };
}

/** A signed auth block. `over` lets a test tamper with one field after signing. */
function auth(account, { lease = 0, at = Date.now(), recipient = 'fairnest-vault', signer = account, over = {} } = {}) {
  const k = key(signer);
  const message = `Open the FairNest vault for lease ${lease} at ${at}`;
  const nonce = randomBytes(32);
  const digest = createHash('sha256').update(nep413(message, nonce, recipient)).digest();
  const signature = sign(null, digest, k.privateKey).toString('base64');
  return { accountId: account, publicKey: k.publicKey, signature, message, nonce: nonce.toString('base64'), recipient, ...over };
}

async function post(path, body) {
  const res = await fetch(SITE + path, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const open = (a, lease = 0) => post(`/api/vault/${lease}/open`, { auth: a });

const haveKeys = ['fairnest-tenant', 'fairnest-tenant2', 'fairnest-landlord', 'fairnest-arbiter'].every((a) => key(`${a}.testnet`));
const signed = haveKeys ? test : test.skip;

test('no signature: refused', async () => {
  const r = await post('/api/vault/0/open', {});
  assert.equal(r.status, 403);
  assert.match(r.body.error, /Access denied/);
});

signed('current NFT holder (fairnest-tenant2) is let in as holder', async () => {
  const r = await open(auth('fairnest-tenant2.testnet'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.role, 'holder');
  assert.ok(Array.isArray(r.body.items));
});

signed('landlord is let in as landlord', async () => {
  const r = await open(auth('fairnest-landlord.testnet'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.role, 'landlord');
});

signed('previous tenant who handed the NFT over is refused', async () => {
  const r = await open(auth('fairnest-tenant.testnet'));
  assert.equal(r.status, 403);
  assert.match(r.body.error, /only the current lease NFT holder/);
});

signed('arbiter is refused once the dispute is closed', async () => {
  const r = await open(auth('fairnest-arbiter.testnet'));
  assert.equal(r.status, 403);
});

signed('signature for another lease is refused', async () => {
  const r = await open(auth('fairnest-tenant2.testnet', { lease: 1 }), 0);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /another lease/);
});

signed('signature made for another app (recipient) is refused', async () => {
  const r = await open(auth('fairnest-tenant2.testnet', { recipient: 'evil-app' }));
  assert.equal(r.status, 403);
  assert.match(r.body.error, /another app/);
});

signed('signature older than 10 minutes is refused', async () => {
  const r = await open(auth('fairnest-tenant2.testnet', { at: Date.now() - 11 * 60 * 1000 }));
  assert.equal(r.status, 403);
  assert.match(r.body.error, /expired/);
});

signed('tampered message is refused (signature check)', async () => {
  const at = Date.now();
  const a = auth('fairnest-tenant2.testnet', { at });
  const r = await open({ ...a, message: a.message.replace(/at \d+$/, `at ${at - 1000}`) });
  assert.equal(r.status, 403);
  assert.match(r.body.error, /does not match/);
});

signed("someone else's key claiming the holder's account is refused (access-key check)", async () => {
  const r = await open(auth('fairnest-tenant2.testnet', { signer: 'fairnest-tenant.testnet' }));
  assert.equal(r.status, 403);
  assert.match(r.body.error, /not a full-access key/);
});

signed('holder passes auth on `add`; an empty entry is rejected so nothing is written', async () => {
  const r = await post('/api/vault/0/add', { auth: auth('fairnest-tenant2.testnet'), text: '   ' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Add a note or a photo/);
});
