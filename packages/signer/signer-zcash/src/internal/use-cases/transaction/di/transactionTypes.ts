export const transactionTypes = {
  GetTrustedInputUseCase: Symbol.for("GetTrustedInputUseCase"),
  SignTransactionUseCase: Symbol.for("SignTransactionUseCase"),
  SignPcztTransactionUseCase: Symbol.for("SignPcztTransactionUseCase"),
} as const;
