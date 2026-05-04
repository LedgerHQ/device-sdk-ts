import { ContainerModule } from "inversify";

import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import { ethereumTransactionWeb3CheckModuleFactory } from "@/shared-loaders/web3-checks/ethereum/di/ethereumWeb3CheckModuleFactory";

export const web3ChecksModuleFactory = ({
  chain,
}: {
  chain: ContextModuleChainID;
}) => {
  if (chain === ContextModuleChainID.Ethereum)
    return ethereumTransactionWeb3CheckModuleFactory();
  return new ContainerModule(() => {});
};
