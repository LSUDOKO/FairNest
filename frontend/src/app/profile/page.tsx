'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ContractId } from '@/config';
import { QuietField } from '@/components/field';
import { Mark } from '@/components/mark';
import { useNearWallet } from '@/providers/near-provider';
import { cleanMoveOut, fmt, holders, type Lease, type NftToken } from '@/lib';

export default function ProfilePage() {
  return <Suspense><Profile /></Suspense>;
}

/** Public rental record: anyone can open it, so a tenant can share it with a future landlord. */
function Profile() {
  const router = useRouter();
  const { signedAccountId, viewFunction } = useNearWallet();
  const account = useSearchParams().get('account') || signedAccountId;
  const [leases, setLeases] = useState<Lease[] | null>(null);
  const [tokens, setTokens] = useState<NftToken[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!account) return;
    let live = true;
    Promise.all([
      viewFunction({ contractId: ContractId, method: 'get_leases_for', args: { account_id: account } }),
      viewFunction({ contractId: ContractId, method: 'nft_tokens_for_owner', args: { account_id: account } }),
    ])
      .then(([l, t]) => { if (live) { setLeases((l as Lease[]).reverse()); setTokens(t as NftToken[]); } })
      .catch(() => live && setLeases([]));
    return () => { live = false; };
  }, [account, viewFunction]);

  const asTenant = (leases ?? []).filter((l) => holders(l).some((h) => h.account === account));
  const clean = asTenant.filter((l) => cleanMoveOut(l, account));
  const settled = asTenant.filter((l) => l.status === 'Settled' && l.tenant === account);
  const asLandlord = (leases ?? []).filter((l) => l.landlord === account);
  const share = typeof window !== 'undefined' && account ? `${window.location.origin}/profile?account=${account}` : '';

  return (
    <>
      <QuietField />
      <main className="page">
        <div className="wrap">
          <div className="page__head">
            <div>
              <h1 className="page__title">Rental record</h1>
              <p className="page__sub">
                {account ? <>Public history of <span className="mono">{account}</span> on FairNest, read from the contract.</> : 'Look up any NEAR account, or connect your wallet to see your own.'}
              </p>
            </div>
            <form className="actions" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/profile?account=${q.trim()}`); }}>
              <label className="sr-only" htmlFor="acct">Account</label>
              <input id="acct" className="input" placeholder="someone.testnet" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn btn--sm" disabled={!q.trim()}>Look up</button>
            </form>
          </div>

          {account && (
            <div className="grid-2">
              <div>
                <section className="glass panel">
                  <div className="panel__head"><h2>Badges</h2></div>
                  {clean.length > 0 ? (
                    <div className="badge">
                      <div className="badge__seal"><Mark size={34} color="var(--ink)" /></div>
                      <div>
                        <div className="badge__title">Clean move-out × {clean.length}</div>
                        <p className="muted" style={{ fontSize: '0.92rem' }}>
                          Got the full deposit back on {clean.map((l) => `lease #${l.id}`).join(', ')}. Earned only by holding the lease NFT when it settled with nothing deducted, so it cannot be bought or transferred.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="muted">No clean move-out yet. It is earned when a lease settles and the tenant gets the whole deposit back.</p>
                  )}
                  <dl className="parties" style={{ marginTop: 20 }}>
                    <div className="kv"><dt>Leases as tenant</dt><dd className="balance">{asTenant.length}</dd></div>
                    <div className="kv"><dt>Settled as tenant</dt><dd className="balance">{settled.length}</dd></div>
                    <div className="kv"><dt>Leases as landlord</dt><dd className="balance">{asLandlord.length}</dd></div>
                  </dl>
                  {share && (
                    <p className="faint" style={{ fontSize: '0.85rem', marginTop: 16 }}>
                      Share with a future landlord: <a className="mono" href={share}>{share}</a>
                    </p>
                  )}
                </section>

                <section className="glass panel">
                  <div className="panel__head"><h2>Lease history</h2></div>
                  {leases === null ? <p className="muted">Reading the chain…</p> : leases.length === 0 ? <p className="muted">No FairNest leases for this account.</p> : (
                    <div className="list">
                      {leases.map((l) => {
                        const role = l.landlord === account ? 'landlord' : l.tenant === account ? 'tenant' : l.arbiter === account ? 'arbiter' : 'former tenant';
                        return (
                          <Link key={l.id} href={`/lease?id=${l.id}`} className="row">
                            <span><span className="row__title">Lease #{l.id}</span><span className="you">{role}</span></span>
                            <span className="row__meta"><span className="mono">{fmt(l.amount, l.token)}</span><span className="status" data-s={l.status}>{l.status}</span></span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <section className="glass panel">
                <div className="panel__head"><h2>Lease NFTs held</h2><span className="faint mono">{tokens.length}</span></div>
                {tokens.length === 0 ? <p className="muted">No lease NFTs right now. A tenant receives one when they lock a deposit.</p> : (
                  <div className="nft-grid">
                    {tokens.map((t) => (
                      <Link key={t.token_id} href={`/lease?id=${t.token_id}`} className="nft-tile">
                        {/* eslint-disable-next-line @next/next/no-img-element -- on-chain SVG */}
                        <img src={t.metadata.media} alt={t.metadata.title} width={200} height={200} />
                        <span>{t.metadata.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
