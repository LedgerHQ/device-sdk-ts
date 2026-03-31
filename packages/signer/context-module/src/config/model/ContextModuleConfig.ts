import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { type BlindSigningReporter } from "@/reporter/domain/BlindSigningReporter";
import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import { type SolanaContextLoader } from "@/solana/domain/SolanaContextLoader";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import { type TypedDataContextLoader } from "@/typed-data/domain/TypedDataContextLoader";

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
  source: string;
};

export type ContextModuleServiceConfig = ContextModuleConfig & {
  originToken: string;
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export type ContextModuleLoaderConfig = {
  defaultLoaders: boolean;
  defaultFieldLoaders: boolean;
  customFieldLoaders: ContextFieldLoader[];
  customLoaders: ContextLoader[];
  customTypedDataLoader?: TypedDataContextLoader;
  customSolanaLoader?: SolanaContextLoader;
  customBlindSigningReporter?: BlindSigningReporter;
  customTrustedNameDataSource?: TrustedNameDataSource;
};
