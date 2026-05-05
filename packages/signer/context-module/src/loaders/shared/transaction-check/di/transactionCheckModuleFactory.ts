import { ContainerModule } from "inversify";

import { ethereumTransactionCheckModuleFactory } from "@/loaders/shared/transaction-check/ethereum/di/ethereumTransactionCheckModuleFactory";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";

export const transactionCheckModuleFactory = ({
  chain,
}: {
  chain: ContextModuleChainID;
}) => {
  if (chain === ContextModuleChainID.Ethereum)
    return ethereumTransactionCheckModuleFactory();
  return new ContainerModule(() => {});
};
