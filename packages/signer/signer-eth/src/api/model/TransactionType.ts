/**
 * The ethereum transaction type as according to eip-2718 transactions
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-2718.md
 */
export enum TransactionType {
  LEGACY = 0,
  EIP2930 = 1,
  EIP1559 = 2,
  EIP4844 = 3,
}
