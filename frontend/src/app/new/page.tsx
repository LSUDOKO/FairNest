'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContractId, TokenId } from '@/config';
import { useNearWallet } from '@/providers/near-provider';
import { useTx } from '@/components/tx';
import { QuietField } from '@/components/field';
import { decimals, toUnits } from '@/lib';

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function NewLease() {
  const { signedAccountId, loading, signIn, callFunction } = useNearWallet();
  const router = useRouter();
  const tx = useTx();
  const [f, setF] = useState(() => ({
    tenant: '',
    arbiter: '',
    currency: 'tusdc',
    amount: '1500',
    leaseEnd: localInput(new Date(Date.now() + 2 * 60000)),
    claimMin: '3',
    responseMin: '3',
    arbiterMin: '3',
    terms: '',
  }));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const token = f.currency === 'tusdc' ? TokenId : null;
  const mins = (m: string) => String(Math.max(1, Math.round(Number(m) * 60)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void tx.run(async () => {
      const r = await callFunction({
        contractId: ContractId,
        method: 'create_lease',
        args: {
          tenant: f.tenant.trim(),
          arbiter: f.arbiter.trim(),
          token,
          amount: toUnits(f.amount, decimals(token)),
          lease_end: String(Math.floor(new Date(f.leaseEnd).getTime() / 1000)),
          claim_window: mins(f.claimMin),
          response_window: mins(f.responseMin),
          arbiter_window: mins(f.arbiterMin),
          terms: f.terms.trim(),
        },
        deposit: '100000000000000000000000', // 0.1 NEAR storage deposit
        gas: '50000000000000',
      });
      router.push(`/lease?id=${r.result as string}`);
      return r;
    });
  };

  return (
    <>
      <QuietField />
      <main className="page">
        <div className="wrap">
          <div className="page__head">
            <div>
              <h1 className="page__title">Create a lease</h1>
              <p className="page__sub">
                You are the landlord. The tenant will lock the deposit into the contract, and nobody can move it alone after that.
              </p>
            </div>
          </div>

          <div className="grid-2">
            {!signedAccountId ? (
              <section className="glass panel">
                <div className="empty">
                  <p>Connect the landlord&apos;s testnet wallet to create a lease. It costs a 0.1 NEAR storage deposit.</p>
                  <button className="btn btn--primary btn--sm" disabled={loading} onClick={() => void signIn()}>Connect wallet</button>
                </div>
              </section>
            ) : (
              <form className="glass panel form" onSubmit={submit}>
                <fieldset>
                  <legend>Who is involved</legend>
                  <label className="field-label">Tenant account
                    <input required className="input" placeholder="tenant.testnet" autoComplete="off" value={f.tenant} onChange={set('tenant')} />
                  </label>
                  <label className="field-label">Arbiter account <span className="hint">A neutral third party both of you trust, or a DAO. They only see disputed lines.</span>
                    <input required className="input" placeholder="arbiter.testnet" autoComplete="off" value={f.arbiter} onChange={set('arbiter')} />
                  </label>
                </fieldset>

                <fieldset>
                  <legend>The deposit</legend>
                  <div className="cols" style={{ ['--cols' as string]: 2 }}>
                    <label className="field-label">Currency
                      <select className="select" value={f.currency} onChange={set('currency')}>
                        <option value="tusdc">tUSDC, test stablecoin</option>
                        <option value="near">NEAR</option>
                      </select>
                    </label>
                    <label className="field-label">Amount
                      <input required className="input" inputMode="decimal" value={f.amount} onChange={set('amount')} />
                    </label>
                  </div>
                  <label className="field-label">Lease ends
                    <input required type="datetime-local" className="input" value={f.leaseEnd} onChange={set('leaseEnd')} />
                  </label>
                </fieldset>

                <fieldset>
                  <legend>Deadlines, in minutes</legend>
                  <p className="hint" style={{ marginTop: -6 }}>Short for the demo. A real lease would use days: 14 days is 20160 minutes.</p>
                  <div className="cols" style={{ ['--cols' as string]: 3 }}>
                    <label className="field-label">Landlord files deductions within<input className="input" inputMode="numeric" value={f.claimMin} onChange={set('claimMin')} /></label>
                    <label className="field-label">Tenant answers within<input className="input" inputMode="numeric" value={f.responseMin} onChange={set('responseMin')} /></label>
                    <label className="field-label">Arbiter rules within<input className="input" inputMode="numeric" value={f.arbiterMin} onChange={set('arbiterMin')} /></label>
                  </div>
                </fieldset>

                <label className="field-label">Address or terms <span className="hint">Optional and public, up to 300 characters.</span>
                  <input className="input" maxLength={300} placeholder="12 months, 1 Main St, Apt 4" value={f.terms} onChange={set('terms')} />
                </label>

                <div className="actions">
                  <button className="btn btn--primary" disabled={tx.busy}>{tx.busy ? 'Waiting for your wallet…' : 'Create lease'}</button>
                  <span className="faint" style={{ fontSize: '0.85rem' }}>Signed as <span className="mono">{signedAccountId}</span> · 0.1 NEAR storage deposit</span>
                </div>
                {tx.status}
              </form>
            )}

            <aside className="glass panel">
              <h2>What happens next</h2>
              <ol className="timeline" style={{ marginTop: 18 }}>
                <li><span className="timeline__kind">Share the lease number</span><div className="muted">The tenant opens it and locks the deposit. Until then you can cancel.</div></li>
                <li><span className="timeline__kind">After the end date</span><div className="muted">File deductions line by line with evidence, or return the full deposit.</div></li>
                <li><span className="timeline__kind">If you file nothing in time</span><div className="muted">The tenant can take the full deposit back. Set a window you can meet.</div></li>
              </ol>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
