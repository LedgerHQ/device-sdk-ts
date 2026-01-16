import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { calldataModuleFactory } from "@/calldata/di/calldataModuleFactory";
import { configModuleFactory } from "@/config/di/configModuleFactory";
import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { dynamicNetworkModuleFactory } from "@/dynamic-network/di/dynamicNetworkModuleFactory";
import { externalPluginModuleFactory } from "@/external-plugin/di/externalPluginModuleFactory";
import { nftModuleFactory } from "@/nft/di/nftModuleFactory";
import { nanoPkiModuleFactory } from "@/pki/di/pkiModuleFactory";
import { proxyModuleFactory } from "@/proxy/di/proxyModuleFactory";
import { safeModuleFactory } from "@/safe/di/safeModuleFactory";
import { solanaContextModuleFactory } from "@/solana/di/SolanaContextModuleFactory";
import { solanaLifiModuleFactory } from "@/solanaLifi/di/lifiModuleFactory";
import { solanaTokenModuleFactory } from "@/solanaToken/di/tokenModuleFactory";
import { tokenModuleFactory } from "@/token/di/tokenModuleFactory";
import { transactionCheckModuleFactory } from "@/transaction-check/di/transactionCheckModuleFactory";
import { trustedNameModuleFactory } from "@/trusted-name/di/trustedNameModuleFactory";
import { typedDataModuleFactory } from "@/typed-data/di/typedDataModuleFactory";
import { uniswapModuleFactory } from "@/uniswap/di/uniswapModuleFactory";

type MakeContainerArgs = {
  config: ContextModuleConfig;
};

export const makeContainer = ({ config }: MakeContainerArgs) => {
  const container = new Container();

  if (config.loggerFactory) {
    container
      .bind<
        (tag: string) => LoggerPublisherService
      >(configTypes.ContextModuleLoggerFactory)
      .toConstantValue(config.loggerFactory);
  }

  container.loadSync(
    configModuleFactory(config),
    externalPluginModuleFactory(),
    dynamicNetworkModuleFactory(),
    nftModuleFactory(),
    proxyModuleFactory(config),
    safeModuleFactory(),
    tokenModuleFactory(),
    calldataModuleFactory(),
    trustedNameModuleFactory(),
    typedDataModuleFactory(),
    nanoPkiModuleFactory(),
    uniswapModuleFactory(),
    transactionCheckModuleFactory(),
    solanaContextModuleFactory(),
    solanaTokenModuleFactory(),
    solanaLifiModuleFactory(),
  );

  return container;
};
