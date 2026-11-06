import Link from 'next/link';
import { useNearWallet } from '@/providers/near-provider';

export const Navigation = () => {
  const { signedAccountId, loading, signIn, signOut } = useNearWallet();
  const label = loading ? 'Loading...' : signedAccountId ? `Log out ${signedAccountId}` : 'Connect wallet';

  return (
    <nav className="navbar border-bottom bg-white">
      <div className="container" style={{ maxWidth: 880 }}>
        <Link href="/" className="navbar-brand fw-semibold">
          <i className="bi bi-house-heart me-2" style={{ color: 'var(--fn-accent)' }} />
          FairNest
        </Link>
        <div className="d-flex gap-2">
          <Link href="/new" className="btn btn-outline-secondary btn-sm">New lease</Link>
          <button className="btn btn-primary btn-sm" onClick={() => void (signedAccountId ? signOut() : signIn())}>
            {label}
          </button>
        </div>
      </div>
    </nav>
  );
};
