// FairNest Worker: serves the static app and the gated lease vault API.
//
// The vault holds private files for a lease (move-in photos, inspection notes). They live
// off-chain in KV, because anything on-chain is public. Every request carries a NEP-413
// signed message, and the Worker checks, on every request:
//   1. the signature over the NEP-413 payload,
//   2. that the key is a full-access key of the claimed account (testnet RPC),
//   3. that the account is the lease NFT's current holder, the landlord, or the arbiter while a
//      dispute is open (read from the contract, never cached).
// So the moment the NFT moves, the old holder's next request is refused.

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  VAULT: KVNamespace;
  CONTRACT_ID?: string;
}
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(opts: { prefix: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}

type Auth = { accountId: string; publicKey: string; signature: string; message: string; nonce: string; recipient: string };
type Item = { author: string; role: string; ts: number; kind: string; text: string; image?: string };

const RPC = 'https://rpc.testnet.fastnear.com';
const RECIPIENT = 'fairnest-vault';
const MAX_AGE_MS = 10 * 60 * 1000;
const MAX_IMAGE = 1_400_000; // data URL characters (~1 MB image)
const MAX_ITEMS = 60;

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/api\/vault\/(\d+)\/(open|add)$/);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!m || req.method !== 'POST') return json({ error: 'not found' }, 404);
    try {
      const body = (await req.json()) as { auth: Auth; kind?: string; text?: string; image?: string };
      const leaseId = m[1];
      const who = await authorize(env, leaseId, body.auth);
      if (m[2] === 'open') return json({ role: who.role, items: await items(env, leaseId) });

      const text = String(body.text ?? '').slice(0, 2000).trim();
      const image = body.image && /^data:image\/(jpeg|png|webp);base64,/.test(body.image) ? body.image : undefined;
      if (!text && !image) return json({ error: 'Add a note or a photo.' }, 400);
      if (image && image.length > MAX_IMAGE) return json({ error: 'Photo is too large. Use one under 1 MB.' }, 413);
      const existing = await env.VAULT.list({ prefix: `vault:${leaseId}:` });
      if (existing.keys.length >= MAX_ITEMS) return json({ error: 'This vault is full.' }, 409);
      const kind = ['move-in', 'move-out', 'note'].includes(String(body.kind)) ? String(body.kind) : 'note';
      const item: Item = { author: who.accountId, role: who.role, ts: Date.now(), kind, text, image };
      await env.VAULT.put(`vault:${leaseId}:${item.ts}`, JSON.stringify(item));
      // KV listing is eventually consistent, so make sure the new record shows up at once.
      const now = await items(env, leaseId);
      if (!now.some((i) => i.ts === item.ts)) now.unshift(item);
      return json({ role: who.role, items: now });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: msg }, msg.startsWith('Access denied') ? 403 : 400);
    }
  },
};
export default worker;

async function items(env: Env, leaseId: string): Promise<Item[]> {
  const { keys } = await env.VAULT.list({ prefix: `vault:${leaseId}:` });
  const all = await Promise.all(keys.map((k) => env.VAULT.get(k.name)));
  return all.filter(Boolean).map((v) => JSON.parse(v as string) as Item).sort((a, b) => b.ts - a.ts);
}

async function authorize(env: Env, leaseId: string, a: Auth) {
  if (!a?.accountId || !a.publicKey || !a.signature || !a.message || !a.nonce) throw new Error('Access denied: sign in with your wallet first.');
  if (a.recipient !== RECIPIENT) throw new Error('Access denied: signature was made for another app.');
  const stamp = a.message.match(/^Open the FairNest vault for lease (\d+) at (\d+)$/);
  if (!stamp || stamp[1] !== leaseId) throw new Error('Access denied: signature is for another lease.');
  if (Math.abs(Date.now() - Number(stamp[2])) > MAX_AGE_MS) throw new Error('Access denied: signature expired, unlock again.');

  const nonce = b64(a.nonce);
  if (nonce.length !== 32) throw new Error('Access denied: bad nonce.');
  const pub = keyBytes(a.publicKey);
  const sig = a.signature.startsWith('ed25519:') ? b58(a.signature.slice(8)) : b64(a.signature);
  const digest = await crypto.subtle.digest('SHA-256', nep413(a.message, nonce, a.recipient));
  const key = await crypto.subtle.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify']);
  if (!(await crypto.subtle.verify('Ed25519', key, sig, digest))) throw new Error('Access denied: signature does not match.');

  const access = await rpc('view_access_key', { account_id: a.accountId, public_key: a.publicKey });
  if (access?.permission !== 'FullAccess') throw new Error('Access denied: that key is not a full-access key of this account.');

  const lease = await view(env.CONTRACT_ID ?? 'fairnest-leases.testnet', 'get_lease', { lease_id: leaseId });
  if (!lease) throw new Error('Access denied: no such lease.');
  const role =
    a.accountId === lease.tenant ? 'holder' :
    a.accountId === lease.landlord ? 'landlord' :
    a.accountId === lease.arbiter && lease.status === 'Disputed' ? 'arbiter' : '';
  if (!role) throw new Error('Access denied: only the current lease NFT holder and the landlord can open this vault.');
  return { accountId: a.accountId, role };
}

/** NEP-413 payload: borsh(u32 tag = 2^31 + 413, { message, nonce[32], recipient, callbackUrl: None }). */
function nep413(message: string, nonce: Uint8Array, recipient: string): Uint8Array {
  const enc = new TextEncoder();
  const m = enc.encode(message), r = enc.encode(recipient);
  const out = new Uint8Array(4 + 4 + m.length + 32 + 4 + r.length + 1);
  const dv = new DataView(out.buffer);
  let o = 0;
  dv.setUint32(o, 2 ** 31 + 413, true); o += 4;
  dv.setUint32(o, m.length, true); o += 4; out.set(m, o); o += m.length;
  out.set(nonce, o); o += 32;
  dv.setUint32(o, r.length, true); o += 4; out.set(r, o); o += r.length;
  out[o] = 0; // callbackUrl: None
  return out;
}

async function rpc(request_type: string, params: Record<string, unknown>) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type, finality: 'final', ...params } }),
  });
  const j = (await res.json()) as { result?: Record<string, unknown> & { result?: number[] }; error?: unknown };
  return j.result;
}

async function view(contract: string, method: string, args: unknown) {
  const r = await rpc('call_function', { account_id: contract, method_name: method, args_base64: btoa(JSON.stringify(args)) });
  if (!r?.result) throw new Error('Could not read the lease from the chain.');
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result)));
}

function keyBytes(pk: string): Uint8Array {
  if (!pk.startsWith('ed25519:')) throw new Error('Access denied: only ed25519 keys are supported.');
  return b58(pk.slice(8));
}

function b64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function b58(s: string): Uint8Array {
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const c of s) {
    const i = A.indexOf(c);
    if (i < 0) throw new Error('Access denied: bad key encoding.');
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c === '1') bytes.unshift(0); else break; }
  return new Uint8Array(bytes);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
