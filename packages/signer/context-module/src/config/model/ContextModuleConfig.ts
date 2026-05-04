import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { type BlindSigningReporter } from "@/chain-agnostic-loaders/reporter/domain/BlindSigningReporter";
import { type TrustedNameDataSource } from "@/ethereum-loaders/trusted-name/data/TrustedNameDataSource";
import { type TypedDataContextLoader } from "@/ethereum-loaders/typed-data/domain/TypedDataContextLoader";
import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import { type ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";

export type ContextModuleCalMode = "prod" | "test";
export type ContextModuleCalBranch = "next" | "main" | "demo";

export type ContextModuleCalConfig = {
  url: string;
  mode: ContextModuleCalMode;
  branch: ContextModuleCalBranch;
};

export type ContextModuleWeb3ChecksConfig = {
  url: string;
};

export type ContextModuleMetadataServiceConfig = {
  url: string;
};

export type ContextModuleReporterConfig = {
  url: string;
};

export type ContextModuleDatasourceConfig = {
  proxy?: "safe" | "default";
};

export type ContextModuleConfig = {
  cal: ContextModuleCalConfig;
  web3checks: ContextModuleWeb3ChecksConfig;
  metadataServiceDomain: ContextModuleMetadataServiceConfig;
  reporter: ContextModuleReporterConfig;
  datasource: ContextModuleDatasourceConfig;
  appSource: string;
  chain?: ContextModuleChainID;
};

export type ContextModuleServiceConfig = Omit<ContextModuleConfig, "chain"> & {
  chain: ContextModuleChainID;
  originToken: string;
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export type ContextModuleLoaderConfig = {
  defaultLoaders: boolean;
  defaultFieldLoaders: boolean;
  customFieldLoaders: ContextFieldLoader[];
  customLoaders: ContextLoader[];
  customTypedDataLoader?: TypedDataContextLoader;
  customBlindSigningReporter?: BlindSigningReporter;
  customTrustedNameDataSource?: TrustedNameDataSource;
};
