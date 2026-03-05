export interface TransactionFetcherService {
  fetchTransaction(signature: string, rpcUrl?: string): Promise<string>;
}
