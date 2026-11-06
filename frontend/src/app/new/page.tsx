'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContractId, TokenId } from '@/config';
import { useNearWallet } from '@/providers/near-provider';
import { useTx } from '@/components/tx';
import { decimals, toUnits } from '@/lib';

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function NewLease() {
  const { signedAccountId, callFunction } = useNearWallet();
  const router = useRouter();
  const tx = useTx();
  const [f, setF] = useState({
    tenant: '',
    arbiter: '',
    currency: 'tusdc',
    amount: '1500',
    leaseEnd: localInput(new Date(Date.now() + 2 * 60000)),
    claimMin: '3',
    responseMin: '3',
    arbiterMin: '3',
    terms: '',
  });
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
      router.push(`/lease/${r.result as string}`);
      return r;
    });
  };

  if (!signedAccountId) return <main><div className="card p-3 mt-3">Connect the landlord&apos;s testnet wallet to create a lease.</div></main>;

  return (
    <main>
      <h1 className="h4 mt-3">New lease</h1>
      <p className="muted">You are the landlord: <span className="mono">{signedAccountId}</span>. Creating a lease costs a 0.1 NEAR storage deposit.</p>
      <form className="card p-3 d-grid gap-3" onSubmit={submit}>
        <label>Tenant account<input required className="form-control" placeholder="tenant.testnet" value={f.tenant} onChange={set('tenant')} /></label>
        <label>Arbiter account <span className="small muted">(a neutral third party, or a Sputnik DAO)</span>
          <input required className="form-control" placeholder="arbiter.testnet" value={f.arbiter} onChange={set('arbiter')} />
        </label>
        <div className="row g-2">
          <label className="col-sm-4">Currency
            <select className="form-select" value={f.currency} onChange={set('currency')}>
              <option value="tusdc">tUSDC (test stablecoin)</option>
              <option value="near">NEAR</option>
            </select>
          </label>
          <label className="col-sm-8">Deposit amount<input required className="form-control" inputMode="decimal" value={f.amount} onChange={set('amount')} /></label>
        </div>
        <label>Lease ends<input required type="datetime-local" className="form-control" value={f.leaseEnd} onChange={set('leaseEnd')} /></label>
        <div>
          <div className="mb-1">Deadlines, in minutes <span className="small muted">(short for the demo; a real lease would use days, e.g. 14 days = 20160)</span></div>
          <div className="row g-2">
            <label className="col-sm-4 small">Landlord must claim within<input className="form-control" value={f.claimMin} onChange={set('claimMin')} /></label>
            <label className="col-sm-4 small">Tenant must answer within<input className="form-control" value={f.responseMin} onChange={set('responseMin')} /></label>
            <label className="col-sm-4 small">Arbiter must rule within<input className="form-control" value={f.arbiterMin} onChange={set('arbiterMin')} /></label>
          </div>
        </div>
        <label>Terms / address <span className="small muted">(optional, public)</span>
          <input className="form-control" maxLength={300} placeholder="12 months, 1 Main St, Apt 4" value={f.terms} onChange={set('terms')} />
        </label>
        <button className="btn btn-primary" disabled={tx.busy}>{tx.busy ? 'Waiting for wallet...' : 'Create lease'}</button>
        {tx.status}
      </form>
    </main>
  );
}
