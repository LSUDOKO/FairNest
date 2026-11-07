'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContractId, ExplorerAccount, TokenId } from '@/config';
import { useNearWallet } from '@/providers/near-provider';
import { useTx } from '@/components/tx';
import { fmt, type Lease } from '@/lib';

export default function Home() {
  const { signedAccountId, viewFunction, callFunction } = useNearWallet();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [balances, setBalances] = useState<{ near: string; tusdc: string }>({ near: '0', tusdc: '0' });
  const [lookup, setLookup] = useState('');
  const router = useRouter();

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
    <main>
      <h1 className="h3 mt-3">Your rent deposit, held by a contract, not your landlord.</h1>
      <p className="muted">
        The tenant locks the security deposit in a NEAR contract. At move-out the landlord itemises
        deductions with evidence; the tenant accepts or disputes line by line; a neutral arbiter rules only
        on disputed lines. Deadlines stop anyone from sitting on the money.
      </p>
      <p className="small muted">
        Contract <a className="mono" href={ExplorerAccount(ContractId)} target="_blank" rel="noreferrer">{ContractId}</a> on testnet
      </p>

      <form className="input-group my-3" onSubmit={(e) => { e.preventDefault(); if (lookup) router.push(`/lease?id=${lookup}`); }}>
        <input className="form-control" placeholder="Open a lease by id, e.g. 0" value={lookup} onChange={(e) => setLookup(e.target.value.replace(/\D/g, ''))} />
        <button className="btn btn-outline-secondary">Open</button>
      </form>

      {!signedAccountId ? (
        <div className="card p-3">Connect a testnet wallet to see your leases. Anyone can open a lease by id without logging in.</div>
      ) : (
        <>
          <div className="card p-3 mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <div className="fw-semibold">Withdrawable</div>
                <div>{fmt(balances.near, null)} · {fmt(balances.tusdc, TokenId)}</div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" disabled={tx.busy || balances.near === '0'} onClick={() => void withdraw(null)}>Withdraw NEAR</button>
                <button className="btn btn-primary btn-sm" disabled={tx.busy || balances.tusdc === '0'} onClick={() => void withdraw(TokenId)}>Withdraw tUSDC</button>
                <button className="btn btn-outline-secondary btn-sm" disabled={tx.busy} onClick={() => void faucet()}>Get 1000 test tUSDC</button>
              </div>
            </div>
            {tx.status}
          </div>

          <h2 className="h5">Your leases</h2>
          {leases.length === 0 && <p className="muted">None yet. <Link href="/new">Create one</Link> as a landlord, or ask your landlord for the lease id.</p>}
          <div className="list-group">
            {leases.map((l) => {
              const role = l.landlord === signedAccountId ? 'landlord' : l.tenant === signedAccountId ? 'tenant' : 'arbiter';
              return (
                <Link key={l.id} href={`/lease?id=${l.id}`} className="list-group-item list-group-item-action d-flex justify-content-between">
                  <span>#{l.id} · {l.terms || 'Lease'} <span className="badge text-bg-light ms-1">you: {role}</span></span>
                  <span>{fmt(l.amount, l.token)} <span className="badge text-bg-secondary ms-1">{l.status}</span></span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
