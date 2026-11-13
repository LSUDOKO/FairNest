'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ContractId, ExplorerAccount } from '@/config';
import { useNearWallet } from '@/providers/near-provider';
import { holders, type Lease, type NftToken } from '@/lib';

type Props = {
  lease: Lease;
  busy: boolean;
  /** Runs a contract call through the shared transaction status. */
  run: (fn: () => Promise<{ hash: string } | void>) => Promise<void>;
};

/** The lease's NEP-171 token: its live image, who holds it, and the hand-over controls. */
export function LeaseNft({ lease, busy, run }: Props) {
  const { signedAccountId: me, viewFunction, callFunction } = useNearWallet();
  const [token, setToken] = useState<NftToken | null>(null);
  const [next, setNext] = useState('');
  const minted = lease.status !== 'Created' && lease.status !== 'Cancelled';

  useEffect(() => {
    if (!minted) return;
    let live = true;
    viewFunction({ contractId: ContractId, method: 'nft_token', args: { token_id: lease.id } })
      .then((t) => live && setToken(t as NftToken))
      .catch(() => {});
    return () => { live = false; };
  }, [lease, minted, viewFunction]);

  if (!minted) return null;
  const isL = me === lease.landlord, isHolder = me === lease.tenant;
  const past = holders(lease);
  const canMove = lease.status === 'Funded';

  const approve = (successor: string | null) =>
    run(() => callFunction({ contractId: ContractId, method: 'approve_successor', args: { lease_id: lease.id, successor } }));
  const handOver = () =>
    run(() =>
      callFunction({
        contractId: ContractId,
        method: 'nft_transfer',
        args: { receiver_id: lease.successor, token_id: lease.id, memo: 'Replacement tenant takes over the lease' },
        deposit: '1',
      }),
    );

  return (
    <section className="glass panel nft">
      <div className="panel__head">
        <h2>Lease NFT</h2>
        <a className="faint mono" href={ExplorerAccount(ContractId)} target="_blank" rel="noreferrer">NEP-171 · token {lease.id}</a>
      </div>
      <div className="nft__body">
        {token?.metadata.media ? (
          // eslint-disable-next-line @next/next/no-img-element -- on-chain SVG data URI, nothing to optimise
          <img className="nft__img" src={token.metadata.media} alt={`${token.metadata.title}, ${lease.status}`} width={160} height={160} />
        ) : (
          <div className="nft__img" aria-hidden="true" />
        )}
        <div className="kv">
          <dt>Holder{isHolder && <span className="you">you</span>}</dt>
          <dd><a className="mono" href={ExplorerAccount(lease.tenant)} target="_blank" rel="noreferrer">{lease.tenant}</a></dd>
          <p className="faint" style={{ fontSize: '0.85rem', marginTop: 6 }}>
            Whoever holds this token is the tenant: owed the refund, the only one who can answer a claim, and the only tenant who can open the vault.
          </p>
        </div>
      </div>

      {past.length > 1 && (
        <ol className="timeline" style={{ marginTop: 16 }} aria-label="Holders">
          {past.map((h, i) => (
            <li key={i}>
              <span className="mono">{h.account}</span>
              <div className="faint" style={{ fontSize: '0.82rem' }}>
                {i === past.length - 1 ? 'holds it since' : 'held it from'} {new Date(h.since * 1000).toLocaleString()}
              </div>
            </li>
          ))}
        </ol>
      )}

      {canMove && isL && (
        <form className="form" style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); if (next.trim()) void approve(next.trim()); }}>
          <label className="field-label">Approve a replacement tenant
            <span className="hint">The tenant can then hand the lease, and the deposit, to this account. Nobody else can receive it.</span>
            <input className="input" placeholder="new-tenant.testnet" value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <div className="actions">
            <button className="btn btn--sm" disabled={busy || !next.trim()}>Approve replacement</button>
            {lease.successor && <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void approve(null)}>Withdraw approval</button>}
          </div>
        </form>
      )}

      {canMove && lease.successor && (
        <div className="notice" style={{ marginTop: 14 }}>
          Approved replacement: <span className="mono">{lease.successor}</span>
          {isHolder && (
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => void handOver()}>Hand over the lease</button>
              <span className="faint" style={{ fontSize: '0.82rem' }}>Your wallet asks you to confirm. You lose the refund and all access.</span>
            </div>
          )}
        </div>
      )}
      {!canMove && lease.status !== 'Settled' && (
        <p className="faint" style={{ marginTop: 12, fontSize: '0.85rem' }}>Frozen while a claim is open, so a payout can never be split between two holders.</p>
      )}

      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn btn--sm" href={`/vault?id=${lease.id}`}><i className="bi bi-lock" aria-hidden="true" /> Open the private vault</Link>
      </div>
    </section>
  );
}
