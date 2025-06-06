import { Container } from "inversify";

import { configModuleFactory } from "@/config/di/configModuleFactory";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { externalPluginModuleFactory } from "@/external-plugin/di/externalPluginModuleFactory";
import { networkModuleFactory } from "@/network/di/networkModuleFactory";
import { nftModuleFactory } from "@/nft/di/nftModuleFactory";
import { nanoPkiModuleFactory } from "@/pki/di/pkiModuleFactory";
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
    networkModuleFactory(),
    nftModuleFactory(),
    tokenModuleFactory(),
    transactionModuleFactory(),
    trustedNameModuleFactory(),
    typedDataModuleFactory(),
    nanoPkiModuleFactory(),
    uniswapModuleFactory(),
    web3CheckModuleFactory(),
  );

  return container;
};
