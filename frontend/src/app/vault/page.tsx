'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuietField } from '@/components/field';
import { useNearWallet, type SignedProof } from '@/providers/near-provider';

type Item = { author: string; role: string; ts: number; kind: string; text: string; image?: string };
const KINDS: Record<string, string> = { 'move-in': 'Move-in inspection', 'move-out': 'Move-out inspection', note: 'Note' };

export default function VaultPage() {
  return <Suspense><Vault /></Suspense>;
}

/** Shrinks a photo in the browser so it fits the vault's 1 MB limit. */
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

function Vault() {
  const id = useSearchParams().get('id') ?? '';
  const { signedAccountId: me, loading, signIn, signMessage } = useNearWallet();
  const [proof, setProof] = useState<{ p: SignedProof; at: number } | null>(null);
  const [data, setData] = useState<{ role: string; items: Item[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('move-in');
  const [text, setText] = useState('');
  const [image, setImage] = useState('');

  const auth = async () => {
    if (proof && proof.p.accountId === me && Date.now() - proof.at < 9 * 60_000) return proof.p;
    const at = Date.now();
    const p = await signMessage(`Open the FairNest vault for lease ${id} at ${at}`, 'fairnest-vault');
    setProof({ p, at });
    return p;
  };

  const api = async (action: 'open' | 'add', extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/vault/${id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ auth: await auth(), ...extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status})`);
      setData(j);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await api('add', { kind, text, image: image || undefined })) { setText(''); setImage(''); }
  };

  return (
    <>
      <QuietField />
      <main className="page">
        <div className="wrap">
          <div className="page__head">
            <div>
              <h1 className="page__title">Lease #{id} vault</h1>
              <p className="page__sub">
                Inspection photos and notes for this home. Only the current holder of the lease NFT and the landlord can open it, and the arbiter while a dispute is open.
              </p>
            </div>
            <Link href={`/lease?id=${id}`} className="btn btn--sm">Back to the lease</Link>
          </div>

          <div className="grid-2">
            <div>
              {!me ? (
                <section className="glass panel">
                  <div className="empty">
                    <p>Connect the wallet that holds this lease, or the landlord&apos;s wallet.</p>
                    <button className="btn btn--primary btn--sm" disabled={loading} onClick={() => void signIn()}>Connect wallet</button>
                  </div>
                </section>
              ) : !data ? (
                <section className="glass panel">
                  <div className="empty">
                    <p>Your wallet signs a short message to prove you are <span className="mono">{me}</span>. Nothing is sent on-chain and it costs nothing.</p>
                    <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => void api('open')}>{busy ? 'Waiting for your wallet…' : 'Unlock the vault'}</button>
                  </div>
                  {error && <div className="notice notice--err" style={{ marginTop: 12 }} role="alert">{error}</div>}
                </section>
              ) : (
                <section className="glass panel">
                  <div className="panel__head">
                    <h2>Records</h2>
                    <span className="status" data-s="Settled">Unlocked as {data.role}</span>
                  </div>
                  {data.items.length === 0 ? (
                    <p className="muted">Nothing here yet. Add the move-in inspection first: it is what settles most disputes.</p>
                  ) : (
                    <ol className="timeline">
                      {data.items.map((it) => (
                        <li key={it.ts}>
                          <span className="timeline__kind">{KINDS[it.kind] ?? it.kind}</span>
                          <div className="faint" style={{ fontSize: '0.82rem' }}>
                            <span className="mono">{it.author}</span> ({it.role}) · {new Date(it.ts).toLocaleString()}
                          </div>
                          {it.text && <p style={{ marginTop: 6 }}>{it.text}</p>}
                          {it.image && (
                            // eslint-disable-next-line @next/next/no-img-element -- private image served as a data URL
                            <img src={it.image} alt={`${KINDS[it.kind] ?? 'Vault'} photo`} className="vault__img" />
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  {error && <div className="notice notice--err" role="alert">{error}</div>}
                </section>
              )}
            </div>

            <div>
              {data && (
                <form className="glass panel form" onSubmit={add}>
                  <h2>Add a record</h2>
                  <label className="field-label">Type
                    <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
                      {Object.entries(KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label className="field-label">Note
                    <textarea className="input" rows={4} style={{ paddingTop: 12 }} maxLength={2000} placeholder="Carpet already worn by the window at handover." value={text} onChange={(e) => setText(e.target.value)} />
                  </label>
                  <label className="field-label">Photo <span className="hint">Resized in your browser before upload.</span>
                    <input type="file" accept="image/*" className="input" onChange={async (e) => { const f = e.target.files?.[0]; setImage(f ? await shrink(f) : ''); }} />
                  </label>
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element -- local preview
                    <img src={image} alt="Selected photo preview" className="vault__img" />
                  )}
                  <button className="btn btn--primary btn--sm" disabled={busy || (!text.trim() && !image)}>Add to vault</button>
                </form>
              )}
              <section className="glass panel">
                <h2>Who can open this</h2>
                <ul className="muted" style={{ paddingLeft: 18, margin: '10px 0 0', display: 'grid', gap: 6 }}>
                  <li>The current holder of lease NFT #{id}. Hand the NFT over and your access ends with it.</li>
                  <li>The landlord.</li>
                  <li>The arbiter, only while a dispute is open.</li>
                </ul>
                <p className="faint" style={{ fontSize: '0.85rem', marginTop: 12 }}>
                  The server checks your signature, that the key is a full-access key of your account, and the lease owner on-chain, on every request.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
