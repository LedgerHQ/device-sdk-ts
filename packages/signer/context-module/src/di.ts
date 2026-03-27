import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { calldataModuleFactory } from "@/calldata/di/calldataModuleFactory";
import { configModuleFactory } from "@/config/di/configModuleFactory";
import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleLoaderConfig,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { dynamicNetworkModuleFactory } from "@/dynamic-network/di/dynamicNetworkModuleFactory";
import { externalPluginModuleFactory } from "@/external-plugin/di/externalPluginModuleFactory";
import { gatedSigningModuleFactory } from "@/gated-signing/di/gatedSigningModuleFactory";
import { nftModuleFactory } from "@/nft/di/nftModuleFactory";
import { nanoPkiModuleFactory } from "@/pki/di/pkiModuleFactory";
import { proxyModuleFactory } from "@/proxy/di/proxyModuleFactory";
import { reporterModuleFactory } from "@/reporter/di/reporterModuleFactory";
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
  config: ContextModuleServiceConfig & ContextModuleLoaderConfig;
};

export const makeContainer = ({ config }: MakeContainerArgs) => {
  const container = new Container();

  container
    .bind<
      (tag: string) => LoggerPublisherService
    >(configTypes.ContextModuleLoggerFactory)
    .toConstantValue(config.loggerFactory);

  container.loadSync(
    configModuleFactory(config),
    externalPluginModuleFactory(),
    dynamicNetworkModuleFactory(),
    nftModuleFactory(),
    proxyModuleFactory(config.datasource),
    safeModuleFactory(),
    gatedSigningModuleFactory(),
    tokenModuleFactory(),
    calldataModuleFactory(),
    trustedNameModuleFactory(config.customTrustedNameDataSource),
    typedDataModuleFactory(),
    nanoPkiModuleFactory(),
    uniswapModuleFactory(),
    transactionCheckModuleFactory(),
    solanaContextModuleFactory(),
    solanaTokenModuleFactory(),
    solanaLifiModuleFactory(),
    reporterModuleFactory(),
  );

  return container;
};
