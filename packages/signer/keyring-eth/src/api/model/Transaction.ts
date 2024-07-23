import { Transaction as EthersV5Transaction } from "ethers-v5";
import { Transaction as EthersV6Transaction } from "ethers-v6";

export type Transaction = EthersV5Transaction | EthersV6Transaction;
