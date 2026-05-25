import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { configModuleFactory } from "@/config/di/configModuleFactory";
import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleLoaderConfig,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { accountOwnershipModuleFactory } from "@/modules/concordium/account-ownership/di/accountOwnershipModuleFactory";
import { calldataModuleFactory } from "@/modules/ethereum/calldata/di/calldataModuleFactory";
import { dynamicNetworkModuleFactory } from "@/modules/ethereum/dynamic-network/di/dynamicNetworkModuleFactory";
import { externalPluginModuleFactory } from "@/modules/ethereum/external-plugin/di/externalPluginModuleFactory";
import { gatedSigningModuleFactory } from "@/modules/ethereum/gated-signing/di/gatedSigningModuleFactory";
import { nftModuleFactory } from "@/modules/ethereum/nft/di/nftModuleFactory";
import { proxyModuleFactory } from "@/modules/ethereum/proxy/di/proxyModuleFactory";
import { safeModuleFactory } from "@/modules/ethereum/safe/di/safeModuleFactory";
import { tokenModuleFactory as ethereumTokenModuleFactory } from "@/modules/ethereum/token/di/tokenModuleFactory";
import { trustedNameModuleFactory } from "@/modules/ethereum/trusted-name/di/trustedNameModuleFactory";
import { typedDataModuleFactory } from "@/modules/ethereum/typed-data/di/typedDataModuleFactory";
import { uniswapModuleFactory } from "@/modules/ethereum/uniswap/di/uniswapModuleFactory";
import { nanoPkiModuleFactory } from "@/modules/multichain/pki/di/pkiModuleFactory";
import { reporterModuleFactory } from "@/modules/multichain/reporter/di/reporterModuleFactory";
import { ethereumTransactionCheckModuleFactory } from "@/modules/multichain/transaction-check/di/ethereumTransactionCheckModuleFactory";
import { solanaTransactionCheckModuleFactory } from "@/modules/multichain/transaction-check/di/solanaTransactionCheckModuleFactory";
import { altResolutionModuleFactory } from "@/modules/solana/alt-resolution/di/altResolutionModuleFactory";
import { enumVariantModuleFactory } from "@/modules/solana/enum-variant/di/enumVariantModuleFactory";
import { instructionInfoModuleFactory } from "@/modules/solana/instruction-info/di/instructionInfoModuleFactory";
import { lifiModuleFactory } from "@/modules/solana/lifi/di/lifiModuleFactory";
import { ownerInfoModuleFactory } from "@/modules/solana/owner-info/di/ownerInfoModuleFactory";
import { tokenModuleFactory as solanaTokenModuleFactory } from "@/modules/solana/token/di/tokenModuleFactory";
import { tokenAccountStateModuleFactory } from "@/modules/solana/token-account-state/di/tokenAccountStateModuleFactory";
import { tokenInfoModuleFactory } from "@/modules/solana/token-info/di/tokenInfoModuleFactory";
import { solanaTrustedNameModuleFactory } from "@/modules/solana/trusted-name/di/trustedNameModuleFactory";
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
        ethereumTokenModuleFactory(),
        calldataModuleFactory(),
        typedDataModuleFactory(),
        uniswapModuleFactory(),
        ethereumTransactionCheckModuleFactory(),
      );
      break;
    case ContextModuleChainID.Solana:
      container.loadSync(
        nanoPkiModuleFactory(),
        ownerInfoModuleFactory(),
        solanaTokenModuleFactory(),
        lifiModuleFactory(),
        solanaTransactionCheckModuleFactory(),
        instructionInfoModuleFactory(),
        enumVariantModuleFactory(),
        tokenInfoModuleFactory(),
        tokenAccountStateModuleFactory(),
        altResolutionModuleFactory(),
        solanaTrustedNameModuleFactory(),
      );
      break;
    case ContextModuleChainID.Concordium:
      container.loadSync(
        nanoPkiModuleFactory(),
        accountOwnershipModuleFactory(),
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
