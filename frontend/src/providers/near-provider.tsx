'use client';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FailoverRpcProvider, getTransactionLastResult, JsonRpcProvider, nearToYocto } from 'near-api-js';
import type { EventMap, NearConnector, NearConnectorOptions } from '@hot-labs/near-connect';
import { ContractId, NetworkId } from '@/config';

type ViewFunctionParams = {
  contractId: string;
  method: string;
  args?: Record<string, unknown>;
};

type CallFunctionParams = ViewFunctionParams & {
  gas?: string;
  deposit?: string;
};

type NearContextValue = {
  loading: boolean;
  signedAccountId: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  viewFunction: (params: ViewFunctionParams) => Promise<unknown>;
  callFunction: (params: CallFunctionParams) => Promise<{ result: unknown; hash: string }>;
};

const NearContext = createContext<NearContextValue | undefined>(undefined);

const connectorOptions: NearConnectorOptions = {
  network: NetworkId,
  providers: {
    mainnet: ['https://free.rpc.fastnear.com'],
    testnet: ['https://test.rpc.fastnear.com'],
  },
};

export function NearProvider({ children }: PropsWithChildren) {
  // Read-only RPC works on the server and before any wallet code loads.
  const provider = useMemo(
    () => new FailoverRpcProvider((connectorOptions.providers?.[NetworkId] ?? []).map((url) => new JsonRpcProvider({ url }))),
    [],
  );

  const [wallet, setWallet] = useState<Awaited<ReturnType<NearConnector['wallet']>> | undefined>();
  const [signedAccountId, setSignedAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  // Wallet libraries need browser APIs, so they load after hydration.
  const ready = useRef<Promise<NearConnector> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const initialize = async () => {
      const [{ NearConnector }, { createAccessKeyPlugin }] = await Promise.all([
        import('@hot-labs/near-connect'),
        import('function-call-key-plugin'),
      ]);
      const connector = new NearConnector(connectorOptions);
      await connector.use(
        createAccessKeyPlugin({
          network: connector.network,
          providers: connector.providers,
          signIn: {
            contractId: ContractId,
            // Non-payable calls are signed locally with a scoped function-call key (no wallet popup).
            methodNames: ['file_claim', 'accept', 'dispute', 'resolve', 'finalize', 'withdraw', 'cancel', 'release_full'],
            allowance: nearToYocto('0.25').toString(),
          },
        }),
      );
      return connector;
    };

    ready.current ??= initialize();
    void ready.current
      .then(async (connector) => {
        const connected = await connector.getConnectedWallet().catch(() => null);
        if (cancelled) return;
        if (connected) {
          setWallet(connected.wallet);
          setSignedAccountId(connected.accounts[0]?.accountId ?? '');
        }
        const onIn = (payload: EventMap['wallet:signIn']) => {
          setWallet(payload.wallet);
          setSignedAccountId(payload.accounts[0]?.accountId ?? '');
        };
        const onOut = () => {
          setWallet(undefined);
          setSignedAccountId('');
        };
        connector.on('wallet:signIn', onIn);
        connector.on('wallet:signOut', onOut);
        cleanup = () => {
          connector.off('wallet:signIn', onIn);
          connector.off('wallet:signOut', onOut);
        };
        setLoading(false);
      })
      .catch((error) => {
        console.error('Unable to initialize wallet', error);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const signIn = useCallback(async () => {
    const connector = await ready.current;
    if (!connector) return;
    const connectedWallet = await connector.connect();
    setWallet(connectedWallet);
    const accounts = await connectedWallet.getAccounts();
    setSignedAccountId(accounts[0]?.accountId ?? '');
  }, []);

  const signOut = useCallback(async () => {
    const connector = await ready.current;
    if (!wallet || !connector) return;
    await connector.disconnect(wallet);
    setWallet(undefined);
    setSignedAccountId('');
  }, [wallet]);

  const viewFunction = useCallback(
    ({ contractId, method, args = {} }: ViewFunctionParams) =>
      provider.callFunction({ contractId, method, args }),
    [provider],
  );

  const callFunction = useCallback(
    async ({ contractId, method, args = {}, gas = '30000000000000', deposit = '0' }: CallFunctionParams) => {
      if (!wallet) throw new Error('Wallet is not connected');

      const result = await wallet.signAndSendTransaction({
        receiverId: contractId,
        actions: [{ type: 'FunctionCall', params: { methodName: method, args, gas, deposit } }],
      });
      return { result: getTransactionLastResult(result), hash: result.transaction.hash };
    },
    [wallet],
  );

  const value = useMemo(
    () => ({ loading, signedAccountId, signIn, signOut, viewFunction, callFunction }),
    [callFunction, loading, signIn, signOut, signedAccountId, viewFunction],
  );

  return <NearContext.Provider value={value}>{children}</NearContext.Provider>;
}

export function useNearWallet() {
  const context = useContext(NearContext);
  if (!context) throw new Error('useNearWallet must be used within NearProvider');
  return context;
}
