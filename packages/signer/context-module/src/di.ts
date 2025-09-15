import { Container } from "inversify";

import { configModuleFactory } from "@/config/di/configModuleFactory";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { dynamicNetworkModuleFactory } from "@/dynamic-network/di/dynamicNetworkModuleFactory";
import { externalPluginModuleFactory } from "@/external-plugin/di/externalPluginModuleFactory";
import { nftModuleFactory } from "@/nft/di/nftModuleFactory";
import { nanoPkiModuleFactory } from "@/pki/di/pkiModuleFactory";
import { proxyModuleFactory } from "@/proxy/di/proxyModuleFactory";
import { solanaContextModuleFactory } from "@/solana/di/SolanaContextModuleFactory";
import { tokenModuleFactory } from "@/token/di/tokenModuleFactory";
import { transactionModuleFactory } from "@/transaction/di/transactionModuleFactory";
import { trustedNameModuleFactory } from "@/trusted-name/di/trustedNameModuleFactory";
import { typedDataModuleFactory } from "@/typed-data/di/typedDataModuleFactory";
import { uniswapModuleFactory } from "@/uniswap/di/uniswapModuleFactory";
import { web3CheckModuleFactory } from "@/web3-check/di/web3CheckModuleFactory";

type MakeContainerArgs = {
  config: ContextModuleConfig;
};

export const makeContainer = ({ config }: MakeContainerArgs) => {
  const container = new Container();

  container.loadSync(
    configModuleFactory(config),
    externalPluginModuleFactory(),
    dynamicNetworkModuleFactory(),
    nftModuleFactory(),
    proxyModuleFactory(),
    tokenModuleFactory(),
    transactionModuleFactory(),
    trustedNameModuleFactory(),
    typedDataModuleFactory(),
    nanoPkiModuleFactory(),
    uniswapModuleFactory(),
    web3CheckModuleFactory(),
    solanaContextModuleFactory(),
  );

  return container;
};
