'use client';
import { useState } from 'react';
import { ExplorerTx } from '@/config';

/** Runs a wallet action, shows a spinner, the error, or a link to the transaction. */
export function useTx(onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hash, setHash] = useState('');

  const run = async (fn: () => Promise<{ hash: string } | void>) => {
    setBusy(true);
    setError('');
    try {
      const r = await fn();
      if (r?.hash) setHash(r.hash);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const status = (
    <>
      {error && <div className="alert alert-danger mt-2 mono" role="alert">{error}</div>}
      {hash && (
        <div className="alert alert-success mt-2">
          Done. <a href={ExplorerTx(hash)} target="_blank" rel="noreferrer">View transaction <i className="bi bi-box-arrow-up-right" /></a>
        </div>
      )}
    </>
  );
  return { busy, run, status };
}
