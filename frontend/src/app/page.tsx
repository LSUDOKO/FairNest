'use client';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ContractId, ExplorerAccount } from '@/config';
import { Field } from '@/components/field';
import { Mark } from '@/components/mark';
import { useNearWallet } from '@/providers/near-provider';
import { fmt, type Lease } from '@/lib';

const ease = [0.22, 1, 0.36, 1] as const;

export default function Landing() {
  return (
    <main>
      <Hero />
      <Problem />
      <HowItWorks />
      <Deadlines />
      <LeaseNftSection />
      <LiveLease />
      <Details />
      <Closing />
    </main>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="hero">
      <Field
        intro
        parallax
        orbs={[
          { kind: 'halo', size: 'min(110vw, 1250px)', x: '66%', y: '40%', drift: 1 },
          { kind: 'halo', size: 'min(70vw, 760px)', x: '26%', y: '70%', drift: 2 },
          { kind: 'shade', size: 'min(40vw, 460px)', x: '27%', y: '27%', drift: 2 },
          { kind: 'lens', size: 'min(42vw, 470px)', x: '29%', y: '63%', drift: 1 },
          { kind: 'lens', size: 'min(96vw, 1040px)', x: '52%', y: '45%', ratio: 1.75 },
        ]}
      />

      <div className="hero__center wrap">
        {/* The intro runs in CSS so it plays from the static HTML, before any JavaScript loads. */}
        <h1 className="hero__word intro" style={{ ['--d' as string]: '0.2s' }}>
          <Mark className="mark" color="var(--ink)" />
          <span>Fair<span className="nest">Nest</span></span>
        </h1>
        <ul className="tag-row hero__tags" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[<Sun key="s" />, 'Deposit locked', 'Deductions itemised', 'Disputes ruled'].map((t, i) => (
            <li key={i} className={`intro ${typeof t === 'string' ? 'tag' : 'tag-sun'}`} style={{ ['--d' as string]: `${0.7 + i * 0.09}s` }}>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="hero__foot wrap intro" style={{ ['--d' as string]: '1s' }}>
        <p className="hero__lede">Your rent deposit, held by a contract instead of your landlord.</p>
        <div className="hero__actions">
          <Link href="/app" className="btn btn--primary">Open the app</Link>
          <Link href="/lease?id=0" className="btn">See a settled lease</Link>
        </div>
      </div>
    </section>
  );
}

function Sun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1="12" y1="2.5" x2="12" y2="6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${i * 22.5} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

/* ---------------------------------------------------------------- problem */

const PROBLEM =
  'A security deposit is often two months of rent. Today the landlord holds it, decides the deductions alone, and returns it when it suits them. Disputing a charge means small-claims court, months later.';

function Problem() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = PROBLEM.split(' ');
  const still = useReducedMotion();
  return (
    <section className="section">
      <div className="wrap">
        <p ref={ref} className="reveal-text">
          {still ? PROBLEM : words.map((w, i) => (
            <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>{w}</Word>
          ))}
        </p>
      </div>
    </section>
  );
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return <motion.span style={{ opacity }}>{children} </motion.span>;
}

/* ---------------------------------------------------------------- how it works */

const STEPS = [
  {
    who: 'Landlord, then tenant',
    title: 'The tenant locks the deposit and gets the lease NFT.',
    body: 'The landlord sets the amount, picks a neutral arbiter and the deadlines. The tenant sends the deposit in tUSDC or NEAR and receives an NFT that is the deposit position. From here, neither of them can move the money alone.',
  },
  {
    who: 'Landlord',
    title: 'At move-out, the landlord itemises deductions.',
    body: 'Each line gets a reason, an amount and an evidence link. The photo or invoice is fingerprinted in the browser, so it cannot be swapped after the fact.',
  },
  {
    who: 'Tenant',
    title: 'The tenant accepts, or disputes line by line.',
    body: 'Disputing the carpet does not freeze the paint. Every line left undisputed, and the rest of the deposit, is paid out the moment the tenant answers.',
  },
  {
    who: 'Arbiter',
    title: 'A neutral arbiter rules on what is disputed.',
    body: 'The arbiter splits only the amount in dispute. Both sides withdraw their share when they like, and every step stays on the public record.',
  },
];

function HowItWorks() {
  const [active, setActive] = useState(0);
  return (
    <section className="section" id="how" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <h2 className="section__title">How a FairNest lease works</h2>
        <p className="section__intro">Four moves, three people, one contract. Follow a 1,500 tUSDC deposit from move-in to payout.</p>
        <div className="explain">
          <div className="explain__stage">
            <StageCard step={active} />
          </div>
          <div className="explain__steps">
            {STEPS.map((s, i) => (
              <motion.article
                key={i}
                className="step"
                data-active={active === i}
                viewport={{ margin: '-45% 0px -45% 0px' }}
                onViewportEnter={() => setActive(i)}
              >
                <span className="step__n">Step {i + 1} of 4</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <span className="step__who">{s.who}</span>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const STAGE = [
  { status: 'Funded', note: 'Locked in the contract', landlord: 0, tenant: 0 },
  { status: 'Claimed', note: '600 tUSDC claimed, 900 untouched', landlord: 0, tenant: 0 },
  { status: 'Disputed', note: '400 tUSDC held for the arbiter', landlord: 200, tenant: 900 },
  { status: 'Settled', note: 'Arbiter awarded 100 of the 400', landlord: 300, tenant: 1200 },
] as const;

function StageCard({ step }: { step: number }) {
  const s = STAGE[step];
  return (
    <div className="glass lease-card" aria-live="polite">
      <div className="lease-card__top">
        <span className="faint mono">Lease #0 · example</span>
        <motion.span key={s.status} className="status" data-s={s.status} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          {s.status}
        </motion.span>
      </div>
      <div>
        <div className="lease-card__amt">1,500 tUSDC</div>
        <motion.div key={s.note} className="muted lease-card__note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 6 }}>{s.note}</motion.div>
      </div>
      <motion.div layout className="claims">
        {step >= 1 &&
          [['Repaint living room', 200], ['Replace carpet', 400]].map(([r, a], i) => (
            <motion.div
              key={r}
              layout
              className="claim-line"
              data-disputed={step >= 2 && i === 1}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, ease }}
            >
              <span>{r}{step >= 2 && i === 1 && <span className="faint"> · disputed</span>}</span>
              <span className="mono">{a}</span>
            </motion.div>
          ))}
      </motion.div>
      <div className="split">
        <div className="split__bar">
          <motion.div className="split__l" animate={{ width: `${(s.landlord / 1500) * 100}%` }} transition={{ duration: 0.8, ease }} />
          <motion.div className="split__t" animate={{ width: `${(s.tenant / 1500) * 100}%` }} transition={{ duration: 0.8, ease }} />
        </div>
        <div className="split__legend">
          <span><i className="swatch" style={{ background: 'var(--core)' }} />Landlord <b>{s.landlord}</b></span>
          <span><i className="swatch" style={{ background: 'var(--glow)' }} />Tenant <b>{s.tenant}</b></span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- deadlines */

const RULES = [
  ['The landlord files nothing in time', <>The tenant gets <strong>the full deposit back</strong>.</>],
  ['The tenant never answers the claim', <>The claim <strong>stands as filed</strong>, and the rest goes to the tenant.</>],
  ['The arbiter never rules', <>The disputed amount <strong>returns to the tenant</strong>. The landlord carries the burden of proof.</>],
] as const;

function Deadlines() {
  return (
    <section className="section">
      <div className="wrap">
        <h2 className="section__title">Nobody can sit on the money</h2>
        <p className="section__intro">
          Every stage has a deadline set when the lease is created. When one passes, anyone can press the button that applies it.
        </p>
        <div className="rules">
          {RULES.map(([cond, out], i) => (
            <div key={i} className="glass rule">
              <div className="rule__if">If {cond.charAt(0).toLowerCase() + cond.slice(1)}</div>
              <div className="rule__then">{out}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- lease NFT */

const NFT_USES = [
  {
    img: '/photos/keys.jpg',
    alt: 'A hand holding a house key on a keyring in a stairwell',
    credit: ['Jakub Żerdzicki', 'https://unsplash.com/photos/Vg96IZTFubo'],
    title: 'Moving out early? Hand it over.',
    body: 'The landlord approves a replacement tenant, and the NFT moves to them with the deposit, the refund rights and every tenant action. The old tenant keeps nothing.',
  },
  {
    img: '/photos/empty-flat.jpg',
    alt: 'An empty, freshly cleaned apartment with a fitted kitchen and wooden floor',
    credit: ['Lisa Anna', 'https://unsplash.com/photos/PfeKrK-V_XA'],
    title: 'A private vault for the inspection.',
    body: 'Move-in photos and notes stay off-chain. Only the current NFT holder and the landlord can open them, checked against the chain on every request.',
  },
  {
    img: '/photos/moving.jpg',
    alt: 'A woman carrying a cardboard box in a living room full of moving boxes',
    credit: ['Vitaly Gariev', 'https://unsplash.com/photos/wS40ELZROLE'],
    title: 'A record that follows you.',
    body: 'Get the whole deposit back and you earn a clean move-out badge. Share your rental record with the next landlord instead of a reference letter.',
  },
];

function LeaseNftSection() {
  const { viewFunction } = useNearWallet();
  const [media, setMedia] = useState('');
  useEffect(() => {
    let live = true;
    viewFunction({ contractId: ContractId, method: 'nft_token', args: { token_id: '0' } })
      .then((t) => live && setMedia((t as { metadata: { media: string } } | null)?.metadata.media ?? ''))
      .catch(() => {});
    return () => { live = false; };
  }, [viewFunction]);

  return (
    <section className="section" id="nft">
      <div className="wrap">
        <div className="nft-intro">
          <div>
            <h2 className="section__title">The deposit is an NFT that does something</h2>
            <p className="section__intro">
              When the tenant locks the deposit, the contract mints a NEP-171 token. Whoever holds it is the tenant: owed the refund, the only one who can answer a claim, the only tenant who can open the vault. Its image changes as the lease moves on.
            </p>
            <ul className="tag-row" style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', color: 'var(--text-2)' }}>
              <li className="tag">Holds the deposit</li>
              <li className="tag">Moves only to an approved tenant</li>
              <li className="tag">Frozen during a claim</li>
            </ul>
          </div>
          {media && (
            <Link href="/lease?id=0" className="nft-live" aria-label="Lease NFT #0 on testnet">
              {/* eslint-disable-next-line @next/next/no-img-element -- on-chain SVG data URI */}
              <img src={media} alt="Lease NFT #0, rendered by the contract" width={260} height={260} />
              <span className="faint mono">Live from testnet · lease #0</span>
            </Link>
          )}
        </div>
        <div className="uses">
          {NFT_USES.map((u) => (
            <article key={u.title} className="use">
              <figure className="use__photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-sized photo */}
                <img src={u.img} alt={u.alt} loading="lazy" width={800} height={533} />
                <figcaption>Photo: <a href={u.credit[1]} target="_blank" rel="noreferrer">{u.credit[0]}</a> on Unsplash</figcaption>
              </figure>
              <h3>{u.title}</h3>
              <p>{u.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- live proof */

function LiveLease() {
  const { viewFunction } = useNearWallet();
  const [lease, setLease] = useState<Lease | null>(null);
  useEffect(() => {
    let live = true;
    viewFunction({ contractId: ContractId, method: 'get_lease', args: { lease_id: '0' } })
      .then((l) => live && setLease(l as Lease))
      .catch(() => {});
    return () => { live = false; };
  }, [viewFunction]);

  const total = lease ? Number(lease.amount) : 1;
  return (
    <section className="section">
      <div className="wrap">
        <h2 className="section__title">Already settled on testnet</h2>
        <p className="section__intro">
          Lease #0 ran the full flow on the real contract: the first tenant handed the lease NFT to a replacement, who then disputed a deduction. These numbers are read from the chain as this page loads.
        </p>
        <div className="glass proof">
          <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
            <div className="lease-card__top">
              <span className="faint mono">Lease #0</span>
              <span className="status" data-s={lease?.status ?? 'Created'}>{lease?.status ?? 'Reading chain'}</span>
            </div>
            <div className="lease-card__amt">{lease ? fmt(lease.amount, lease.token) : '…'}</div>
            <div className="split">
              <div className="split__bar">
                <motion.div className="split__l" initial={{ width: 0 }} animate={{ width: lease ? `${(Number(lease.to_landlord) / total) * 100}%` : 0 }} transition={{ duration: 1, ease }} />
                <motion.div className="split__t" initial={{ width: 0 }} animate={{ width: lease ? `${(Number(lease.to_tenant) / total) * 100}%` : 0 }} transition={{ duration: 1, delay: 0.15, ease }} />
              </div>
              <div className="split__legend">
                <span><i className="swatch" style={{ background: 'var(--core)' }} />Landlord <b>{lease ? fmt(lease.to_landlord, lease.token) : '…'}</b></span>
                <span><i className="swatch" style={{ background: 'var(--glow)' }} />Tenant <b>{lease ? fmt(lease.to_tenant, lease.token) : '…'}</b></span>
              </div>
            </div>
            <div className="hero__actions">
              <Link href="/lease?id=0" className="btn btn--primary btn--sm">Open lease #0</Link>
              <a href={ExplorerAccount(ContractId)} target="_blank" rel="noreferrer" className="btn btn--sm">
                Contract on NearBlocks <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
              </a>
            </div>
          </div>
          <ol className="timeline">
            {(lease?.history ?? []).map((e, i) => (
              <li key={i}>
                <span className="timeline__kind">{e.kind.replace(/_/g, ' ')}</span>
                <span className="faint"> by </span>
                <span className="mono faint">{e.actor}</span>
                {e.note && <div className="muted" style={{ fontSize: '0.9rem' }}>{e.kind === 'funded' || e.kind === 'claimed' ? fmt(e.note, lease!.token) : e.note}</div>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- details */

const DETAILS = [
  ['Stablecoin or NEAR', 'Hold the deposit in a dollar stablecoin so its value does not swing, or in NEAR. The demo uses tUSDC, a test token with a free faucet.'],
  ['Evidence that cannot change', 'Each deduction stores the sha256 fingerprint of its photo or invoice. If the file is edited later, the fingerprint no longer matches.'],
  ['You withdraw your own share', 'Settlement credits a balance; you pull it to your wallet when you like. A failed transfer puts the balance back, so funds never get stuck.'],
  ['A record you can keep', 'Every step is an on-chain event with who did it and when. Download the full history of a lease as a CSV for your files.'],
];

function Details() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <h2 className="section__title">Built so either side can trust it</h2>
        <div className="facts">
          {DETAILS.map(([t, b]) => (
            <div key={t} className="fact">
              <h3>{t}</h3>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- closing */

function Closing() {
  return (
    <section className="cta">
      <Field
        orbs={[
          { kind: 'halo', size: 'min(120vw, 1300px)', x: '50%', y: '55%', drift: 1 },
          { kind: 'lens', size: 'min(90vw, 980px)', x: '50%', y: '52%', ratio: 1.9, drift: 2 },
        ]}
      />
      <div className="wrap">
        <h2>Start a lease in two minutes</h2>
        <div className="hero__actions">
          <Link href="/new" className="btn btn--primary">Create a lease</Link>
          <Link href="/app" className="btn" style={{ color: 'var(--ink)', borderColor: 'rgba(22,23,47,.35)' }}>Go to dashboard</Link>
        </div>
      </div>
    </section>
  );
}
