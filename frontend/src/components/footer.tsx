import Link from 'next/link';
import { ContractId, ExplorerAccount, TokenId } from '@/config';
import { Mark } from '@/components/mark';

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mark size={22} color="var(--glow)" />
          <span>FairNest runs on NEAR testnet. Test money only.</span>
        </div>
        <nav aria-label="Footer">
          <Link href="/app">Dashboard</Link>
          <Link href="/new">New lease</Link>
          <Link href="/profile">Rental record</Link>
          <a href={ExplorerAccount(ContractId)} target="_blank" rel="noreferrer">Escrow + NFT contract</a>
          <a href={ExplorerAccount(TokenId)} target="_blank" rel="noreferrer">tUSDC token</a>
          <a href="https://github.com/LSUDOKO/FairNest" target="_blank" rel="noreferrer">Source on GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
