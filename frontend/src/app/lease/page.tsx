'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ContractId, ExplorerAccount } from '@/config';
import { useNearWallet } from '@/providers/near-provider';
import { useTx } from '@/components/tx';
import { claimTotal, countdown, deadline, decimals, fmt, fromUnits, nowSecs, sha256Hex, toCsv, toUnits, type Lease } from '@/lib';

const STAGE_HELP: Record<string, string> = {
  Created: 'Waiting for the tenant to lock the deposit.',
  Funded: 'Deposit is locked. After the lease ends the landlord can file deductions. If they file none before the deadline, anyone can refund the tenant in full.',
  Claimed: 'Landlord filed deductions. The tenant can accept, or dispute specific lines. If the tenant does nothing before the deadline, the claim stands.',
  Disputed: 'Undisputed lines are already paid out. The arbiter rules on the disputed lines. If the arbiter does nothing before the deadline, the disputed sum goes back to the tenant.',
  Settled: 'Settled. Each side can withdraw their share from the home page.',
  Cancelled: 'Cancelled by the landlord before it was funded.',
};

type Draft = { reason: string; amount: string; evidence_url: string; evidence_sha256: string };
const emptyLine: Draft = { reason: '', amount: '', evidence_url: '', evidence_sha256: '' };

export default function LeasePage() {
  return <Suspense><LeaseView /></Suspense>;
}

function LeaseView() {
  const id = useSearchParams().get('id') ?? '';
  const { signedAccountId: me, viewFunction, callFunction } = useNearWallet();
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

  if (lease === undefined) return <main><p className="mt-3">Loading lease #{id}...</p></main>;
  if (lease === null) return <main><div className="alert alert-warning mt-3">No lease #{id} on {ContractId}.</div></main>;

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
    <div className="col-sm-4">
      <div className="small muted">{label}{you && ' (you)'}</div>
      <a className="mono" href={ExplorerAccount(acc)} target="_blank" rel="noreferrer">{acc}</a>
    </div>
  );

  return (
    <main>
      <div className="d-flex justify-content-between align-items-start mt-3">
        <div>
          <h1 className="h4 mb-0">Lease #{lease.id}</h1>
          <div className="muted">{lease.terms}</div>
        </div>
        <span className="badge text-bg-dark fs-6">{lease.status}</span>
      </div>

      <div className="card p-3 my-3">
        <div className="row g-2 mb-2">
          {party('Landlord', lease.landlord, isL)}
          {party('Tenant', lease.tenant, isT)}
          {party('Arbiter', lease.arbiter, isA)}
        </div>
        <div className="fs-5">Deposit: <strong>{fmt(lease.amount, lease.token)}</strong></div>
        <div className="small muted">Lease ends {new Date(Number(lease.lease_end) * 1000).toLocaleString()}</div>
        <p className="mt-2 mb-0">{STAGE_HELP[lease.status]}</p>
        {due !== null && (
          <p className="mb-0">
            Deadline: <strong>{new Date(due * 1000).toLocaleString()}</strong> ({countdown(due)})
          </p>
        )}
        {(lease.status === 'Settled' || lease.status === 'Disputed') && (
          <p className="mb-0">Paid so far: landlord {fmt(lease.to_landlord, lease.token)} · tenant {fmt(lease.to_tenant, lease.token)}</p>
        )}
      </div>

      {/* ---------- actions ---------- */}
      {!me && <div className="alert alert-light">Connect a wallet to act on this lease. Anyone can apply an expired deadline.</div>}

      {lease.status === 'Created' && isT && (
        <div className="card p-3 mb-3">
          <h2 className="h6">Lock your deposit</h2>
          <p className="small muted mb-2">The money goes to the contract, not the landlord. {lease.token && 'You need this token in your wallet; use "Get 1000 test tUSDC" on the home page.'}</p>
          <button className="btn btn-primary" disabled={tx.busy} onClick={() => void fund()}>Deposit {fmt(lease.amount, lease.token)}</button>
        </div>
      )}
      {lease.status === 'Created' && isL && (
        <button className="btn btn-outline-danger mb-3" disabled={tx.busy} onClick={() => void call('cancel', {})}>Cancel unfunded lease</button>
      )}

      {lease.status === 'Funded' && isL && (
        <div className="card p-3 mb-3">
          <h2 className="h6">Move-out deductions</h2>
          {!ended && <p className="small text-warning-emphasis">The lease has not ended yet; deductions open at the end date.</p>}
          {lines.map((l, i) => (
            <div key={i} className="border rounded p-2 mb-2">
              <div className="row g-2">
                <input className="form-control col" placeholder="Reason, e.g. broken window" value={l.reason} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} />
                <input className="form-control col-3" placeholder="Amount" inputMode="decimal" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              </div>
              <input className="form-control mt-2" placeholder="Evidence link (photo, invoice)" value={l.evidence_url} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, evidence_url: e.target.value } : x)))} />
              <label className="small mt-2 d-block">Fingerprint the evidence file (stays on your device, only its sha256 goes on-chain):
                <input type="file" className="form-control form-control-sm" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const h = await sha256Hex(file);
                  setLines(lines.map((x, j) => (j === i ? { ...x, evidence_sha256: h } : x)));
                }} />
              </label>
              {l.evidence_sha256 && <div className="mono small">sha256 {l.evidence_sha256}</div>}
            </div>
          ))}
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" disabled={lines.length >= 10} onClick={() => setLines([...lines, { ...emptyLine }])}>Add line</button>
            <button className="btn btn-primary btn-sm" disabled={tx.busy || !ended} onClick={() => void fileClaim()}>File claim</button>
            <button className="btn btn-outline-success btn-sm ms-auto" disabled={tx.busy} onClick={() => void call('release_full', {})}>Return full deposit</button>
          </div>
        </div>
      )}

      {lease.claim.length > 0 && (
        <div className="card p-3 mb-3">
          <h2 className="h6">Claimed deductions: {fmt(claimTotal(lease).toString(), lease.token)}</h2>
          <table className="table table-sm mb-2">
            <tbody>
              {lease.claim.map((l, i) => (
                <tr key={i} className={lease.disputed.includes(i) ? 'table-warning' : ''}>
                  {lease.status === 'Claimed' && isT && (
                    <td><input type="checkbox" aria-label={`dispute line ${i + 1}`} checked={picked.includes(i)} onChange={(e) => setPicked(e.target.checked ? [...picked, i] : picked.filter((p) => p !== i))} /></td>
                  )}
                  <td>{l.reason}{lease.disputed.includes(i) && <span className="badge text-bg-warning ms-2">disputed</span>}</td>
                  <td className="text-end">{fromUnits(l.amount, dec)}</td>
                  <td>{l.evidence_url && <a href={l.evidence_url} target="_blank" rel="noreferrer">evidence</a>}{l.evidence_sha256 && <div className="mono small">{l.evidence_sha256.slice(0, 16)}...</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lease.status === 'Claimed' && isT && (
            <>
              <input className="form-control mb-2" placeholder="Why you dispute the ticked lines (public)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="d-flex gap-2">
                <button className="btn btn-primary btn-sm" disabled={tx.busy} onClick={() => void call('accept', {})}>Accept all</button>
                <button className="btn btn-warning btn-sm" disabled={tx.busy || picked.length === 0} onClick={() => void call('dispute', { lines: picked, reason })}>Dispute {picked.length} line(s)</button>
              </div>
            </>
          )}
        </div>
      )}

      {lease.status === 'Disputed' && isA && (
        <div className="card p-3 mb-3">
          <h2 className="h6">Your ruling on {fmt(disputedSum.toString(), lease.token)} in dispute</h2>
          <label className="small">Amount awarded to the landlord (the rest returns to the tenant)
            <input className="form-control" inputMode="decimal" placeholder={`0 to ${fromUnits(disputedSum.toString(), dec)}`} value={award} onChange={(e) => setAward(e.target.value)} />
          </label>
          <input className="form-control my-2" placeholder="Reasoning (public)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={tx.busy || !award} onClick={() => void call('resolve', { to_landlord: toUnits(award, dec), note: reason })}>Submit ruling</button>
        </div>
      )}

      {expired && me && (
        <button className="btn btn-outline-primary mb-3" disabled={tx.busy} onClick={() => void call('finalize', {})}>Deadline passed: apply it</button>
      )}
      {tx.status}

      {/* ---------- timeline ---------- */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <h2 className="h6 mb-0">On-chain timeline</h2>
        <button className="btn btn-link btn-sm" onClick={downloadCsv}><i className="bi bi-download" /> CSV for your records</button>
      </div>
      <ul className="timeline ps-0 mt-2">
        {lease.history.map((e, i) => (
          <li key={i}>
            <strong>{e.kind.replace(/_/g, ' ')}</strong> by <span className="mono">{e.actor}</span>
            <span className="muted small"> · {new Date(Number(e.ts) * 1000).toLocaleString()}</span>
            {e.note && <div className="small">{e.kind === 'funded' || e.kind === 'claimed' ? fmt(e.note, lease.token) : e.note}</div>}
          </li>
        ))}
      </ul>
    </main>
  );
}
