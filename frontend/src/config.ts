// Contract ids come from env so a judge can point the app at their own deployment.
// Defaults are the FairNest testnet deployment described in the README.
export const NetworkId: 'mainnet' | 'testnet' = 'testnet';
export const ContractId: string = process.env.NEXT_PUBLIC_CONTRACT_ID ?? 'fairnest-escrow.testnet';
export const TokenId: string = process.env.NEXT_PUBLIC_TOKEN_ID ?? 'fairnest-tusdc.testnet';
export const ExplorerTx = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
export const ExplorerAccount = (id: string) => `https://testnet.nearblocks.io/address/${id}`;
