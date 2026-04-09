export const transactionCheckTypes = {
  TransactionCheckDataSource: Symbol.for("TransactionCheckDataSource"),
  EthereumTransactionCheckContextLoader: Symbol.for(
    "EthereumTransactionCheckContextLoader",
  ),
  SolanaTransactionCheckContextLoader: Symbol.for(
    "SolanaTransactionCheckContextLoader",
  ),
  TypedDataCheckDataSource: Symbol.for("TypedDataCheckDataSource"),
  TypedDataCheckContextLoader: Symbol.for("TypedDataCheckContextLoader"),
};
