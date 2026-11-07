'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mark } from '@/components/mark';
import { useNearWallet } from '@/providers/near-provider';

export const Navigation = () => {
  const { signedAccountId, loading, signIn, signOut } = useNearWallet();
  const path = usePathname();
  const here = (p: string) => (path === p ? 'page' : undefined);

  return (
    <header className="nav glass">
      <Link href="/" className="nav__brand" aria-label="FairNest home">
        <Mark size={24} color="var(--glow)" />
        <span>FairNest</span>
      </Link>
      <nav className="nav__links" aria-label="Main">
        <Link href="/#how" className="hide-sm">How it works</Link>
        <Link href="/app" aria-current={here('/app')}>Dashboard</Link>
        <Link href="/new" aria-current={here('/new')} className="hide-sm">New lease</Link>
      </nav>
      {signedAccountId ? (
        <button className="btn btn--sm" onClick={() => void signOut()} title={`Signed in as ${signedAccountId}. Click to log out.`}>
          <span className="nav__acct mono">{signedAccountId}</span>
          <i className="bi bi-box-arrow-right" aria-hidden="true" />
          <span className="sr-only">Log out</span>
        </button>
      ) : (
        <button className="btn btn--primary btn--sm" disabled={loading} onClick={() => void signIn()}>
          {loading ? 'Loading wallet' : 'Connect wallet'}
        </button>
      )}
    </header>
  );
};
