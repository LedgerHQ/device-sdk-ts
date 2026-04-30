import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { accountOwnershipModuleFactory } from "@/account-ownership/di/accountOwnershipModuleFactory";
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
import { networkModuleFactory } from "@/network/di/networkModuleFactory";
import { nftModuleFactory } from "@/nft/di/nftModuleFactory";
import { nanoPkiModuleFactory } from "@/pki/di/pkiModuleFactory";
import { proxyModuleFactory } from "@/proxy/di/proxyModuleFactory";
import { reporterModuleFactory } from "@/reporter/di/reporterModuleFactory";
import { safeModuleFactory } from "@/safe/di/safeModuleFactory";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import { web3ChecksModuleFactory } from "@/shared/web3-checks/di/web3ChecksModuleFactory";
import { solanaContextModuleFactory } from "@/solana/di/SolanaContextModuleFactory";
import { solanaLifiModuleFactory } from "@/solanaLifi/di/lifiModuleFactory";
import { solanaTokenModuleFactory } from "@/solanaToken/di/tokenModuleFactory";
import { tokenModuleFactory } from "@/token/di/tokenModuleFactory";
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

  const { chain } = config;

  container.loadSync(
    // Chain-agnostic — always loaded
    configModuleFactory(config),
    networkModuleFactory(config),
    trustedNameModuleFactory(config.customTrustedNameDataSource),
    nanoPkiModuleFactory(),
    reporterModuleFactory(),

    // Ethereum-owned — only when chain = Ethereum
    ...(chain === ContextModuleChainID.Ethereum
      ? [
          accountOwnershipModuleFactory(),
          externalPluginModuleFactory(),
          dynamicNetworkModuleFactory(),
          nftModuleFactory(),
          proxyModuleFactory(config.datasource),
          safeModuleFactory(),
          gatedSigningModuleFactory(),
          tokenModuleFactory(),
          calldataModuleFactory(),
          typedDataModuleFactory(),
          uniswapModuleFactory(),
        ]
      : []),

    // Solana-owned — unconditional; scoping is a future task
    solanaContextModuleFactory(),
    solanaTokenModuleFactory(),
    solanaLifiModuleFactory(),

    // Web3-checks
    web3ChecksModuleFactory({ chain: chain! }),
  );

  return container;
};
