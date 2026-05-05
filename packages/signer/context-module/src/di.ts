import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { networkModuleFactory } from "@/chain-agnostic-loaders/network/di/networkModuleFactory";
import { nanoPkiModuleFactory } from "@/chain-agnostic-loaders/pki/di/pkiModuleFactory";
import { reporterModuleFactory } from "@/chain-agnostic-loaders/reporter/di/reporterModuleFactory";
import { concordiumAccountOwnershipModuleFactory } from "@/concordium-loaders/account-ownership/di/concordiumAccountOwnershipModuleFactory";
import { configModuleFactory } from "@/config/di/configModuleFactory";
import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleLoaderConfig,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { calldataModuleFactory } from "@/ethereum-loaders/calldata/di/calldataModuleFactory";
import { dynamicNetworkModuleFactory } from "@/ethereum-loaders/dynamic-network/di/dynamicNetworkModuleFactory";
import { externalPluginModuleFactory } from "@/ethereum-loaders/external-plugin/di/externalPluginModuleFactory";
import { gatedSigningModuleFactory } from "@/ethereum-loaders/gated-signing/di/gatedSigningModuleFactory";
import { nftModuleFactory } from "@/ethereum-loaders/nft/di/nftModuleFactory";
import { proxyModuleFactory } from "@/ethereum-loaders/proxy/di/proxyModuleFactory";
import { safeModuleFactory } from "@/ethereum-loaders/safe/di/safeModuleFactory";
import { tokenModuleFactory } from "@/ethereum-loaders/token/di/tokenModuleFactory";
import { trustedNameModuleFactory } from "@/ethereum-loaders/trusted-name/di/trustedNameModuleFactory";
import { typedDataModuleFactory } from "@/ethereum-loaders/typed-data/di/typedDataModuleFactory";
import { uniswapModuleFactory } from "@/ethereum-loaders/uniswap/di/uniswapModuleFactory";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import { web3ChecksModuleFactory } from "@/shared-loaders/web3-checks/di/web3ChecksModuleFactory";
import { solanaLifiModuleFactory } from "@/solana-loaders/lifi/di/lifiModuleFactory";
import { solanaContextModuleFactory } from "@/solana-loaders/owner-info/di/SolanaContextModuleFactory";
import { solanaTokenModuleFactory } from "@/solana-loaders/token/di/tokenModuleFactory";

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

  // chain agnostic and shared loaders and services
  container.loadSync(
    configModuleFactory(config),
    networkModuleFactory(config),
    nanoPkiModuleFactory(),
    reporterModuleFactory(),
    web3ChecksModuleFactory({ chain }),
  );

  switch (chain) {
    case ContextModuleChainID.Ethereum:
      // ethereum specific loaders and services
      container.loadSync(
        trustedNameModuleFactory(config.customTrustedNameDataSource),
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
      );
      break;
    case ContextModuleChainID.Solana:
      // solana specific loaders and services
      container.loadSync(
        solanaContextModuleFactory(),
        solanaTokenModuleFactory(),
        solanaLifiModuleFactory(),
      );
      break;
    case ContextModuleChainID.Concordium:
      // concordium specific loaders and services
      container.loadSync(concordiumAccountOwnershipModuleFactory());
      break;
    default: {
      // ensure exhaustive check at compile time when new chains are added
      const exhaustiveCheck: never = chain;
      void exhaustiveCheck;
    }
  }

  return container;
};
