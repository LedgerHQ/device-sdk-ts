import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { configModuleFactory } from "@/config/di/configModuleFactory";
import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleLoaderConfig,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { nanoPkiModuleFactory } from "@/modules/chain-agnostic/pki/di/pkiModuleFactory";
import { reporterModuleFactory } from "@/modules/chain-agnostic/reporter/di/reporterModuleFactory";
import { concordiumAccountOwnershipModuleFactory } from "@/modules/concordium/account-ownership/di/concordiumAccountOwnershipModuleFactory";
import { calldataModuleFactory } from "@/modules/ethereum/calldata/di/calldataModuleFactory";
import { dynamicNetworkModuleFactory } from "@/modules/ethereum/dynamic-network/di/dynamicNetworkModuleFactory";
import { externalPluginModuleFactory } from "@/modules/ethereum/external-plugin/di/externalPluginModuleFactory";
import { gatedSigningModuleFactory } from "@/modules/ethereum/gated-signing/di/gatedSigningModuleFactory";
import { nftModuleFactory } from "@/modules/ethereum/nft/di/nftModuleFactory";
import { proxyModuleFactory } from "@/modules/ethereum/proxy/di/proxyModuleFactory";
import { safeModuleFactory } from "@/modules/ethereum/safe/di/safeModuleFactory";
import { tokenModuleFactory } from "@/modules/ethereum/token/di/tokenModuleFactory";
import { trustedNameModuleFactory } from "@/modules/ethereum/trusted-name/di/trustedNameModuleFactory";
import { typedDataModuleFactory } from "@/modules/ethereum/typed-data/di/typedDataModuleFactory";
import { uniswapModuleFactory } from "@/modules/ethereum/uniswap/di/uniswapModuleFactory";
import { transactionCheckModuleFactory } from "@/modules/shared/transaction-check/di/transactionCheckModuleFactory";
import { solanaLifiModuleFactory } from "@/modules/solana/lifi/di/lifiModuleFactory";
import { solanaContextModuleFactory } from "@/modules/solana/owner-info/di/SolanaContextModuleFactory";
import { solanaTokenModuleFactory } from "@/modules/solana/token/di/tokenModuleFactory";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import { networkModuleFactory } from "@/shared/network/di/networkModuleFactory";

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

  // infrastructure modules needed by all chains
  container.loadSync(configModuleFactory(config), networkModuleFactory(config));

  // shared modules needed by all chains (module-level guards)
  container.loadSync(transactionCheckModuleFactory({ chain }));

  switch (chain) {
    case ContextModuleChainID.Ethereum:
      container.loadSync(
        nanoPkiModuleFactory(),
        reporterModuleFactory(),
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
      container.loadSync(
        nanoPkiModuleFactory(),
        solanaContextModuleFactory(),
        solanaTokenModuleFactory(),
        solanaLifiModuleFactory(),
      );
      break;
    case ContextModuleChainID.Concordium:
      container.loadSync(
        nanoPkiModuleFactory(),
        concordiumAccountOwnershipModuleFactory(),
      );
      break;
    default: {
      // ensure exhaustive check at compile time when new chains are added
      const exhaustiveCheck: never = chain;
      void exhaustiveCheck;
    }
  }

  return container;
};
