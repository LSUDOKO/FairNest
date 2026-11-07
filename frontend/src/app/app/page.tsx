'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContractId, ExplorerAccount, TokenId } from '@/config';
import { QuietField } from '@/components/field';
import { useNearWallet } from '@/providers/near-provider';
import { useTx } from '@/components/tx';
import { fmt, type Lease } from '@/lib';

export default function Dashboard() {
  const { signedAccountId, loading, signIn, viewFunction, callFunction } = useNearWallet();
  const [leases, setLeases] = useState<Lease[] | null>(null);
  const [balances, setBalances] = useState<{ near: string; tusdc: string }>({ near: '0', tusdc: '0' });

  const fetchAll = useCallback(async () => {
    if (!signedAccountId) return null;
    const [l, n, t] = await Promise.all([
      viewFunction({ contractId: ContractId, method: 'get_leases_for', args: { account_id: signedAccountId } }),
      viewFunction({ contractId: ContractId, method: 'get_balance', args: { account_id: signedAccountId, token: null } }),
      viewFunction({ contractId: ContractId, method: 'get_balance', args: { account_id: signedAccountId, token: TokenId } }),
    ]);
    return { leases: (l as Lease[]).reverse(), near: n as string, tusdc: t as string };
  }, [signedAccountId, viewFunction]);

  const apply = (d: Awaited<ReturnType<typeof fetchAll>>) => {
    if (!d) return;
    setLeases(d.leases);
    setBalances({ near: d.near, tusdc: d.tusdc });
  };
  const load = () => void fetchAll().then(apply);

  useEffect(() => {
    let live = true;
    fetchAll().then((d) => {
      if (live && d) { setLeases(d.leases); setBalances({ near: d.near, tusdc: d.tusdc }); }
    }).catch(console.error);
    return () => { live = false; };
  }, [fetchAll]);
  const tx = useTx(load);

  const withdraw = (token: string | null) =>
    tx.run(async () => {
      if (token) {
        // The token contract must know the receiver before it can send tUSDC.
        const reg = await viewFunction({ contractId: token, method: 'storage_balance_of', args: { account_id: signedAccountId } });
        if (!reg) await callFunction({ contractId: token, method: 'storage_deposit', args: {}, deposit: '10000000000000000000000' });
      }
      return callFunction({ contractId: ContractId, method: 'withdraw', args: { token }, gas: '60000000000000' });
    });

  const faucet = () =>
    tx.run(() => callFunction({ contractId: TokenId, method: 'mint', args: { amount: '1000000000' } }));

  return (
    <>
      <QuietField />
      <main className="page">
        <div className="wrap">
          <div className="page__head">
            <div>
              <h1 className="page__title">Dashboard</h1>
              <p className="page__sub">
                {signedAccountId ? <>Signed in as <span className="mono">{signedAccountId}</span>.</> : 'Your leases, your balances, and test money for the demo.'}
              </p>
            </div>
            <Link href="/new" className="btn btn--primary">Create a lease</Link>
          </div>

          <div className="grid-2">
            <div>
              <section className="glass panel">
                <div className="panel__head"><h2>Your leases</h2></div>
                {!signedAccountId ? (
                  <div className="empty">
                    <p>Connect a testnet wallet to see the leases where you are the landlord, tenant or arbiter.</p>
                    <button className="btn btn--primary btn--sm" disabled={loading} onClick={() => void signIn()}>Connect wallet</button>
                  </div>
                ) : leases === null ? (
                  <p className="muted">Reading your leases from the chain…</p>
                ) : leases.length === 0 ? (
                  <div className="empty">
                    <p>No leases yet. Landlords start one here. Tenants and arbiters: ask the landlord for the lease number and open it on the right.</p>
                    <Link href="/new" className="btn btn--sm">Create a lease</Link>
                  </div>
                ) : (
                  <div className="list">
                    {leases.map((l) => {
                      const role = l.landlord === signedAccountId ? 'Landlord' : l.tenant === signedAccountId ? 'Tenant' : 'Arbiter';
                      return (
                        <Link key={l.id} href={`/lease?id=${l.id}`} className="row">
                          <span>
                            <span className="row__title">Lease #{l.id}</span>
                            <span className="muted"> {l.terms ? `· ${l.terms}` : ''}</span>
                            <span className="you">you are the {role.toLowerCase()}</span>
                          </span>
                          <span className="row__meta">
                            <span className="mono">{fmt(l.amount, l.token)}</span>
                            <span className="status" data-s={l.status}>{l.status}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <div>
              {signedAccountId && (
                <section className="glass panel">
                  <div className="panel__head"><h2>Ready to withdraw</h2></div>
                  <div className="balance">{fmt(balances.tusdc, TokenId)}</div>
                  <div className="muted">{fmt(balances.near, null)}</div>
                  <p className="faint" style={{ fontSize: '0.88rem', margin: '10px 0 16px' }}>Your share of settled leases waits here until you move it to your wallet.</p>
                  <div className="actions">
                    <button className="btn btn--primary btn--sm" disabled={tx.busy || balances.tusdc === '0'} onClick={() => void withdraw(TokenId)}>Withdraw tUSDC</button>
                    <button className="btn btn--sm" disabled={tx.busy || balances.near === '0'} onClick={() => void withdraw(null)}>Withdraw NEAR</button>
                  </div>
                </section>
              )}
              {signedAccountId && (
                <section className="glass panel">
                  <div className="panel__head"><h2>Test money</h2></div>
                  <p className="muted" style={{ marginBottom: 14 }}>Tenants need tUSDC to lock a deposit. Each click mints 1,000 to your wallet.</p>
                  <button className="btn btn--sm" disabled={tx.busy} onClick={() => void faucet()}>Get 1,000 tUSDC</button>
                </section>
              )}
              <div className="tx-status">{tx.status}</div>
              <OpenById />
              <p className="faint" style={{ fontSize: '0.85rem', marginTop: 16 }}>
                Contract <a className="mono" href={ExplorerAccount(ContractId)} target="_blank" rel="noreferrer">{ContractId}</a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function OpenById() {
  const router = useRouter();
  const [id, setId] = useState('');
  return (
    <section className="glass panel">
      <div className="panel__head"><h2>Open a lease</h2></div>
      <form className="actions" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (id) router.push(`/lease?id=${id}`); }}>
        <label className="sr-only" htmlFor="lease-id">Lease number</label>
        <input id="lease-id" className="input" inputMode="numeric" placeholder="Lease number, e.g. 0" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} />
        <button className="btn btn--sm" disabled={!id}>Open</button>
      </form>
    </section>
  );
}
