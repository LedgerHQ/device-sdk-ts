import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { configModuleFactory } from "@/config/di/configModuleFactory";
import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleLoaderConfig,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { networkModuleFactory } from "@/loaders/chain-agnostic/network/di/networkModuleFactory";
import { nanoPkiModuleFactory } from "@/loaders/chain-agnostic/pki/di/pkiModuleFactory";
import { reporterModuleFactory } from "@/loaders/chain-agnostic/reporter/di/reporterModuleFactory";
import { concordiumAccountOwnershipModuleFactory } from "@/loaders/concordium/account-ownership/di/concordiumAccountOwnershipModuleFactory";
import { calldataModuleFactory } from "@/loaders/ethereum/calldata/di/calldataModuleFactory";
import { dynamicNetworkModuleFactory } from "@/loaders/ethereum/dynamic-network/di/dynamicNetworkModuleFactory";
import { externalPluginModuleFactory } from "@/loaders/ethereum/external-plugin/di/externalPluginModuleFactory";
import { gatedSigningModuleFactory } from "@/loaders/ethereum/gated-signing/di/gatedSigningModuleFactory";
import { nftModuleFactory } from "@/loaders/ethereum/nft/di/nftModuleFactory";
import { proxyModuleFactory } from "@/loaders/ethereum/proxy/di/proxyModuleFactory";
import { safeModuleFactory } from "@/loaders/ethereum/safe/di/safeModuleFactory";
import { tokenModuleFactory } from "@/loaders/ethereum/token/di/tokenModuleFactory";
import { trustedNameModuleFactory } from "@/loaders/ethereum/trusted-name/di/trustedNameModuleFactory";
import { typedDataModuleFactory } from "@/loaders/ethereum/typed-data/di/typedDataModuleFactory";
import { uniswapModuleFactory } from "@/loaders/ethereum/uniswap/di/uniswapModuleFactory";
import { transactionCheckModuleFactory } from "@/loaders/shared/transaction-check/di/transactionCheckModuleFactory";
import { solanaLifiModuleFactory } from "@/loaders/solana/lifi/di/lifiModuleFactory";
import { solanaContextModuleFactory } from "@/loaders/solana/owner-info/di/SolanaContextModuleFactory";
import { solanaTokenModuleFactory } from "@/loaders/solana/token/di/tokenModuleFactory";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";

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
    transactionCheckModuleFactory({ chain }),
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
