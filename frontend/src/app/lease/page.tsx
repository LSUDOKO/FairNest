'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ContractId, ExplorerAccount } from '@/config';
import { useNearWallet } from '@/providers/near-provider';
import { useTx } from '@/components/tx';
import { QuietField } from '@/components/field';
import { claimTotal, countdown, deadline, decimals, fmt, fromUnits, nowSecs, sha256Hex, toCsv, toUnits, type Lease } from '@/lib';

const STAGE_HELP: Record<string, string> = {
  Created: 'Waiting for the tenant to lock the deposit.',
  Funded: 'Deposit is locked. After the lease ends the landlord can file deductions. If they file none before the deadline, anyone can refund the tenant in full.',
  Claimed: 'Landlord filed deductions. The tenant can accept, or dispute specific lines. If the tenant does nothing before the deadline, the claim stands.',
  Disputed: 'Undisputed lines are already paid out. The arbiter rules on the disputed lines. If the arbiter does nothing before the deadline, the disputed sum goes back to the tenant.',
  Settled: 'Settled. Each side can withdraw their share from the dashboard.',
  Cancelled: 'Cancelled by the landlord before it was funded.',
};

type Draft = { reason: string; amount: string; evidence_url: string; evidence_sha256: string };
const emptyLine: Draft = { reason: '', amount: '', evidence_url: '', evidence_sha256: '' };

export default function LeasePage() {
  return <Suspense><LeaseView /></Suspense>;
}

function LeaseView() {
  const id = useSearchParams().get('id') ?? '';
  const { signedAccountId: me, loading, signIn, viewFunction, callFunction } = useNearWallet();
  const [lease, setLease] = useState<Lease | null | undefined>(undefined);
  const [, tick] = useState(0);
  const [lines, setLines] = useState<Draft[]>([{ ...emptyLine }]);
  const [picked, setPicked] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [award, setAward] = useState('');

  const fetchLease = useCallback(
    async () => (await viewFunction({ contractId: ContractId, method: 'get_lease', args: { lease_id: id } })) as Lease | null,
    [id, viewFunction],
  );
  const load = () => void fetchLease().then(setLease);
  useEffect(() => {
    let live = true;
    fetchLease().then((l) => live && setLease(l)).catch(() => live && setLease(null));
    return () => { live = false; };
  }, [fetchLease]);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const tx = useTx(load);

  if (lease === undefined || lease === null)
    return (
      <Shell>
        <h1 className="page__title">Lease #{id || '?'}</h1>
        {lease === undefined ? (
          <p className="page__sub">Reading the lease from the chain…</p>
        ) : (
          <div className="empty" style={{ marginTop: 24 }}>
            <p>There is no lease #{id} on {ContractId}. Check the number with the landlord.</p>
            <Link href="/app" className="btn btn--sm">Back to dashboard</Link>
          </div>
        )}
      </Shell>
    );

  const dec = decimals(lease.token);
  const isL = me === lease.landlord, isT = me === lease.tenant, isA = me === lease.arbiter;
  const due = deadline(lease);
  const expired = due !== null && nowSecs() > due;
  const ended = nowSecs() >= Number(lease.lease_end);
  const disputedSum = lease.disputed.reduce((s, i) => s + BigInt(lease.claim[i].amount), BigInt(0));
  const call = (method: string, args: Record<string, unknown>, extra: { deposit?: string; gas?: string } = {}) =>
    tx.run(() => callFunction({ contractId: ContractId, method, args: { lease_id: lease.id, ...args }, ...extra }));

  const fund = () =>
    tx.run(() =>
      lease.token
        ? callFunction({
            contractId: lease.token,
            method: 'ft_transfer_call',
            args: { receiver_id: ContractId, amount: lease.amount, msg: lease.id },
            deposit: '1',
            gas: '100000000000000',
          })
        : callFunction({ contractId: ContractId, method: 'fund_native', args: { lease_id: lease.id }, deposit: lease.amount }),
    );

  const fileClaim = () =>
    tx.run(() =>
      callFunction({
        contractId: ContractId,
        method: 'file_claim',
        args: { lease_id: lease.id, lines: lines.map((l) => ({ ...l, amount: toUnits(l.amount, dec) })) },
        gas: '50000000000000',
      }),
    );

  const downloadCsv = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(lease)], { type: 'text/csv' }));
    a.download = `fairnest-lease-${lease.id}.csv`;
    a.click();
  };

  const party = (label: string, acc: string, you: boolean) => (
    <div className="kv">
      <dt>{label}{you && <span className="you">you</span>}</dt>
      <dd><a className="mono" href={ExplorerAccount(acc)} target="_blank" rel="noreferrer">{acc}</a></dd>
    </div>
  );

  const order = ['Created', 'Funded', 'Claimed', 'Disputed', 'Settled'];
  const reached = lease.history.map((e) => e.kind);
  const stepState = (st: string, i: number) => {
    if (lease.status === 'Cancelled') return i === 0 ? 'done' : 'skip';
    const cur = order.indexOf(lease.status);
    if (st === lease.status) return 'now';
    if (st === 'Disputed' && cur > 3 && !reached.includes('disputed')) return 'skip';
    if (st === 'Claimed' && cur > 2 && !reached.includes('claimed')) return 'skip';
    return i < cur ? 'done' : 'todo';
  };
  const editLine = (i: number, patch: Partial<Draft>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Shell>
      <div className="page__head">
        <div>
          <h1 className="page__title">Lease #{lease.id}</h1>
          {lease.terms && <p className="page__sub">{lease.terms}</p>}
        </div>
        <span className="status" data-s={lease.status}>{lease.status}</span>
      </div>

      <div className="grid-2">
        <div>
          <section className="glass panel">
            <ol className="stepper" aria-label="Lease progress">
              {order.map((st, i) => <li key={st} data-state={stepState(st, i)}>{st}</li>)}
            </ol>
            <p style={{ marginTop: 16 }}>{STAGE_HELP[lease.status]}</p>
            {due !== null && (
              <div className="deadline" style={{ marginTop: 14 }}>
                <span className="deadline__count">{countdown(due)}</span>
                <span className="faint">deadline {new Date(due * 1000).toLocaleString()}</span>
              </div>
            )}
            {expired && (
              <div className="actions" style={{ marginTop: 14 }}>
                {me ? (
                  <button className="btn btn--primary btn--sm" disabled={tx.busy} onClick={() => void call('finalize', {})}>Apply the passed deadline</button>
                ) : (
                  <span className="muted">The deadline has passed. Connect any wallet to apply it.</span>
                )}
              </div>
            )}
          </section>

          {/* ---------- actions ---------- */}
          {!me && (
            <section className="glass panel">
              <div className="empty">
                <p>Connect the landlord, tenant or arbiter wallet to act on this lease. Anyone can read it.</p>
                <button className="btn btn--primary btn--sm" disabled={loading} onClick={() => void signIn()}>Connect wallet</button>
              </div>
            </section>
          )}

          {lease.status === 'Created' && isT && (
            <section className="glass panel">
              <h2>Lock your deposit</h2>
              <p className="muted" style={{ margin: '8px 0 16px' }}>
                The money goes to the contract, not to the landlord.{' '}
                {lease.token && <>You need the token in your wallet. <Link href="/app">Get test tUSDC on the dashboard.</Link></>}
              </p>
              <button className="btn btn--primary" disabled={tx.busy} onClick={() => void fund()}>Deposit {fmt(lease.amount, lease.token)}</button>
            </section>
          )}
          {lease.status === 'Created' && isL && (
            <section className="glass panel">
              <h2>Waiting for the tenant</h2>
              <p className="muted" style={{ margin: '8px 0 16px' }}>Share lease number {lease.id} with your tenant. Until they deposit, you can cancel.</p>
              <button className="btn btn--danger btn--sm" disabled={tx.busy} onClick={() => void call('cancel', {})}>Cancel this lease</button>
            </section>
          )}

          {lease.status === 'Funded' && isL && (
            <section className="glass panel form">
              <div className="panel__head" style={{ marginBottom: 0 }}>
                <h2>Move-out deductions</h2>
                <button className="btn btn--sm" disabled={tx.busy} onClick={() => void call('release_full', {})}>Return the full deposit</button>
              </div>
              {!ended && <div className="notice notice--warn">The lease has not ended yet. Deductions open on {new Date(Number(lease.lease_end) * 1000).toLocaleString()}.</div>}
              {lines.map((l, i) => (
                <div key={i} className="line-edit">
                  <div className="cols" style={{ ['--cols' as string]: 2, gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
                    <label className="field-label">Reason<input className="input" placeholder="Broken window" value={l.reason} onChange={(e) => editLine(i, { reason: e.target.value })} /></label>
                    <label className="field-label">Amount<input className="input" inputMode="decimal" placeholder="0" value={l.amount} onChange={(e) => editLine(i, { amount: e.target.value })} /></label>
                  </div>
                  <label className="field-label">Evidence link <span className="hint">Photo or invoice anyone can open.</span>
                    <input className="input" placeholder="https://" value={l.evidence_url} onChange={(e) => editLine(i, { evidence_url: e.target.value })} />
                  </label>
                  <label className="field-label">Fingerprint the file <span className="hint">The file stays on your device. Only its sha256 goes on-chain.</span>
                    <input type="file" className="input" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) editLine(i, { evidence_sha256: await sha256Hex(file) });
                    }} />
                  </label>
                  {l.evidence_sha256 && <div className="mono faint">sha256 {l.evidence_sha256}</div>}
                </div>
              ))}
              <div className="actions">
                <button className="btn btn--sm" disabled={lines.length >= 10} onClick={() => setLines([...lines, { ...emptyLine }])}>Add a line</button>
                <button className="btn btn--primary btn--sm push" disabled={tx.busy || !ended} onClick={() => void fileClaim()}>File {lines.length} deduction{lines.length > 1 ? 's' : ''}</button>
              </div>
            </section>
          )}

          {lease.claim.length > 0 && (
            <section className="glass panel">
              <div className="panel__head">
                <h2>Deductions claimed</h2>
                <span className="mono">{fmt(claimTotal(lease).toString(), lease.token)}</span>
              </div>
              <div className="claims">
                {lease.claim.map((l, i) => {
                  const pick = lease.status === 'Claimed' && isT;
                  return (
                    <label key={i} className="claim" data-disputed={lease.disputed.includes(i) || picked.includes(i)} style={{ cursor: pick ? 'pointer' : undefined }}>
                      {pick ? (
                        <input type="checkbox" className="check" checked={picked.includes(i)} onChange={(e) => setPicked(e.target.checked ? [...picked, i] : picked.filter((p) => p !== i))} />
                      ) : <span />}
                      <span>
                        {l.reason}
                        {lease.disputed.includes(i) && <span className="faint"> · disputed</span>}
                        <span className="claim__ev">
                          {l.evidence_url && <> · <a href={l.evidence_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>evidence</a></>}
                          {l.evidence_sha256 && <span className="mono"> · {l.evidence_sha256.slice(0, 12)}…</span>}
                        </span>
                      </span>
                      <span className="claim__amt">{fromUnits(l.amount, dec)}</span>
                    </label>
                  );
                })}
              </div>
              {lease.status === 'Claimed' && isT && (
                <div className="form" style={{ marginTop: 16 }}>
                  <p className="muted">Tick the lines you disagree with. Everything you leave unticked is paid to the landlord now.</p>
                  <label className="field-label">Why you dispute them <span className="hint">Public, the arbiter reads this.</span>
                    <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </label>
                  <div className="actions">
                    <button className="btn btn--primary btn--sm" disabled={tx.busy || picked.length === 0} onClick={() => void call('dispute', { lines: picked, reason })}>
                      Dispute {picked.length || ''} line{picked.length === 1 ? '' : 's'}
                    </button>
                    <button className="btn btn--sm" disabled={tx.busy} onClick={() => void call('accept', {})}>Accept all deductions</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {lease.status === 'Disputed' && isA && (
            <section className="glass panel form">
              <h2>Your ruling on {fmt(disputedSum.toString(), lease.token)}</h2>
              <label className="field-label">Amount for the landlord <span className="hint">The rest goes back to the tenant.</span>
                <input className="input" inputMode="decimal" placeholder={`0 to ${fromUnits(disputedSum.toString(), dec)}`} value={award} onChange={(e) => setAward(e.target.value)} />
              </label>
              <label className="field-label">Reasoning <span className="hint">Public.</span>
                <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className="actions">
                <button className="btn btn--primary btn--sm" disabled={tx.busy || !award} onClick={() => void call('resolve', { to_landlord: toUnits(award, dec), note: reason })}>Submit ruling</button>
              </div>
            </section>
          )}
          <div className="tx-status">{tx.status}</div>
        </div>

        <div>
          <section className="glass panel">
            <div className="lease-card__amt">{fmt(lease.amount, lease.token)}</div>
            <p className="faint" style={{ marginTop: 6 }}>Lease ends {new Date(Number(lease.lease_end) * 1000).toLocaleString()}</p>
            {(lease.status === 'Settled' || lease.status === 'Disputed') && (
              <div className="split" style={{ marginTop: 18 }}>
                <div className="split__bar">
                  <div className="split__l" style={{ width: `${(Number(lease.to_landlord) / Number(lease.amount)) * 100}%` }} />
                  <div className="split__t" style={{ width: `${(Number(lease.to_tenant) / Number(lease.amount)) * 100}%` }} />
                </div>
                <div className="split__legend">
                  <span><i className="swatch" style={{ background: 'var(--core)' }} />Landlord <b>{fmt(lease.to_landlord, lease.token)}</b></span>
                  <span><i className="swatch" style={{ background: 'var(--glow)' }} />Tenant <b>{fmt(lease.to_tenant, lease.token)}</b></span>
                </div>
              </div>
            )}
            <dl className="parties" style={{ gridTemplateColumns: '1fr', marginTop: 22, marginBottom: 0 }}>
              {party('Landlord', lease.landlord, isL)}
              {party('Tenant', lease.tenant, isT)}
              {party('Arbiter', lease.arbiter, isA)}
            </dl>
          </section>

          <section className="glass panel">
            <div className="panel__head">
              <h2>On-chain record</h2>
              <button className="btn btn--ghost btn--sm" onClick={downloadCsv}><i className="bi bi-download" aria-hidden="true" /> CSV</button>
            </div>
            <ol className="timeline">
              {lease.history.map((e, i) => (
                <li key={i}>
                  <span className="timeline__kind">{e.kind.replace(/_/g, ' ')}</span>
                  <div className="faint" style={{ fontSize: '0.82rem' }}>
                    <span className="mono">{e.actor}</span> · {new Date(Number(e.ts) * 1000).toLocaleString()}
                  </div>
                  {e.note && <div className="muted" style={{ fontSize: '0.9rem' }}>{e.kind === 'funded' || e.kind === 'claimed' ? fmt(e.note, lease.token) : e.note}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <QuietField />
      <main className="page"><div className="wrap">{children}</div></main>
    </>
  );
}
