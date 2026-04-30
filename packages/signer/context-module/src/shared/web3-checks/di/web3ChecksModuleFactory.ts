import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import { ethereumWeb3CheckModuleFactory } from "@/shared/web3-checks/ethereum/di/ethereumWeb3CheckModuleFactory";

export const web3ChecksModuleFactory = ({
  chain,
}: {
  chain: ContextModuleChainID;
}) => {
  if (chain === ContextModuleChainID.Ethereum)
    return ethereumWeb3CheckModuleFactory();
  throw new Error(`[web3ChecksModuleFactory] unsupported chain: ${chain}`);
};
