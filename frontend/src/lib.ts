import { TokenId } from '@/config';

export type Status = 'Created' | 'Funded' | 'Claimed' | 'Disputed' | 'Settled' | 'Cancelled';
export type Line = { reason: string; amount: string; evidence_url: string; evidence_sha256: string };
export type Event = { kind: string; actor: string; ts: string; note: string };
export type Lease = {
  id: string;
  landlord: string;
  tenant: string;
  arbiter: string;
  token: string | null;
  amount: string;
  lease_end: string;
  claim_window: string;
  response_window: string;
  arbiter_window: string;
  terms: string;
  status: Status;
  claim: Line[];
  disputed: number[];
  stage_at: string;
  to_landlord: string;
  to_tenant: string;
  history: Event[];
};

export const decimals = (token: string | null) => (token ? 6 : 24);
export const symbol = (token: string | null) => (token === null ? 'NEAR' : token === TokenId ? 'tUSDC' : token);

/** "1.5" -> base units string. Exact string math, no floats. */
export function toUnits(value: string, dec: number): string {
  const [whole, frac = ''] = value.trim().split('.');
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac) || frac.length > dec) throw new Error(`invalid amount "${value}"`);
  const units = BigInt((whole || '0') + frac.padEnd(dec, '0'));
  return units.toString();
}

/** base units string -> "1.5" */
export function fromUnits(units: string, dec: number): string {
  const s = BigInt(units).toString().padStart(dec + 1, '0');
  const whole = s.slice(0, s.length - dec);
  const frac = s.slice(s.length - dec).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

export const fmt = (units: string, token: string | null) => `${fromUnits(units, decimals(token))} ${symbol(token)}`;

export const nowSecs = () => Math.floor(Date.now() / 1000);

/** Deadline (unix secs) for the current stage, or null when nothing is pending. */
export function deadline(l: Lease): number | null {
  if (l.status === 'Funded') return Number(l.lease_end) + Number(l.claim_window);
  if (l.status === 'Claimed') return Number(l.stage_at) + Number(l.response_window);
  if (l.status === 'Disputed') return Number(l.stage_at) + Number(l.arbiter_window);
  return null;
}

export function countdown(until: number): string {
  const s = until - nowSecs();
  if (s <= 0) return 'expired';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function claimTotal(l: Lease): bigint {
  return l.claim.reduce((s, x) => s + BigInt(x.amount), BigInt(0));
}

export function toCsv(l: Lease): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [['date_utc', 'event', 'actor', 'note']];
  for (const e of l.history) rows.push([new Date(Number(e.ts) * 1000).toISOString(), e.kind, e.actor, e.note]);
  rows.push([]);
  rows.push(['line', 'reason', `amount_${symbol(l.token)}`, 'disputed', 'evidence_url', 'evidence_sha256']);
  l.claim.forEach((x, i) =>
    rows.push([String(i + 1), x.reason, fromUnits(x.amount, decimals(l.token)), l.disputed.includes(i) ? 'yes' : 'no', x.evidence_url, x.evidence_sha256]),
  );
  rows.push([]);
  rows.push(['deposit', fromUnits(l.amount, decimals(l.token))]);
  rows.push(['paid_to_landlord', fromUnits(l.to_landlord, decimals(l.token))]);
  rows.push(['paid_to_tenant', fromUnits(l.to_tenant, decimals(l.token))]);
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
