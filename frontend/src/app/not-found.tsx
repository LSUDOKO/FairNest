import Link from 'next/link';
import { QuietField } from '@/components/field';

export default function NotFound() {
  return (
    <>
      <QuietField />
      <main className="page">
        <div className="wrap wrap-narrow">
          <h1 className="page__title">This page does not exist</h1>
          <p className="page__sub">The link may be old. Leases open at /lease?id= followed by their number.</p>
          <div className="actions" style={{ marginTop: 28 }}>
            <Link href="/" className="btn btn--primary">Back to the start</Link>
            <Link href="/app" className="btn">Go to dashboard</Link>
          </div>
        </div>
      </main>
    </>
  );
}
