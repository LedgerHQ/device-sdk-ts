import {
  type LoggerPublisherService,
  noopLoggerFactory,
} from "@ledgerhq/device-management-kit";

import { type ContextModuleConstructorArgs } from "./config/model/ContextModuleBuildArgs";
import {
  type ContextModuleCalConfig,
  type ContextModuleConfig,
  type ContextModuleDatasourceConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleReporterConfig,
  type ContextModuleWeb3ChecksConfig,
  type ResolvedContextModuleConfig,
} from "./config/model/ContextModuleConfig";
import { type BlindSigningReporter } from "./reporter/domain/BlindSigningReporter";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import { type SolanaContextLoader } from "./solana/domain/SolanaContextLoader";
import { type TrustedNameDataSource } from "./trusted-name/data/TrustedNameDataSource";
import { type TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { type ContextModule } from "./ContextModule";
import { DefaultContextModule } from "./DefaultContextModule";

const DEFAULT_CAL_URL = "https://crypto-assets-service.api.ledger.com/v1";
const DEFAULT_WEB3_CHECKS_URL = "https://web3checks-backend.api.ledger.com/v3";
const DEFAULT_METADATA_SERVICE_DOMAIN = "https://nft.api.live.ledger.com";
const DEFAULT_REPORTER_URL = "https://blind-signing-reporting.api.ledger.com";

export const DEFAULT_CONFIG = {
  cal: {
    url: DEFAULT_CAL_URL,
    mode: "prod",
    branch: "main",
  } as ContextModuleCalConfig,
  web3checks: {
    url: DEFAULT_WEB3_CHECKS_URL,
  },
  metadataServiceDomain: {
    url: DEFAULT_METADATA_SERVICE_DOMAIN,
  },
  defaultLoaders: true,
  customLoaders: [],
  defaultFieldLoaders: true,
  customFieldLoaders: [],
  customTypedDataLoader: undefined,
  customSolanaLoader: undefined,
  reporter: {
    url: DEFAULT_REPORTER_URL,
  },
  loggerFactory: noopLoggerFactory,
};

const resolveConfig = (
  config: ContextModuleConfig,
): ResolvedContextModuleConfig => ({
  ...DEFAULT_CONFIG,
  ...config,
  reporter: config.reporter ?? DEFAULT_CONFIG.reporter,
});

export class ContextModuleBuilder {
  private config: ContextModuleConfig;

  constructor({ originToken, loggerFactory }: ContextModuleConstructorArgs) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...(loggerFactory && { loggerFactory }),
      ...(originToken && { originToken }),
    };
  }

  /**
   * Remove default loaders from the list of loaders
   *
   * @returns this
   */
  removeDefaultLoaders() {
    this.config.defaultLoaders = false;
    return this;
  }

  /**
   * Add a custom loader to the list of loaders
   *
   * @param loader loader to add to the list of loaders
   * @returns this
   */
  addLoader(loader: ContextLoader) {
    this.config.customLoaders.push(loader);
    return this;
  }

  /**
   * Replace the default loader for typed data clear signing contexts
   *
   * @param loader loader to use for typed data clear signing contexts
   * @returns this
   */
  addTypedDataLoader(loader: TypedDataContextLoader) {
    this.config.customTypedDataLoader = loader;
    return this;
  }

  /**
   * Replace the default loader for Solana context
   *
   * @param loader loader to use for Solana context
   * @returns this
   */
  addSolanaLoader(loader: SolanaContextLoader) {
    this.config.customSolanaLoader = loader;
    return this;
  }

  /**
   * Add a custom CAL configuration
   *
   * @param calConfig
   * @returns this
   */
  setCalConfig(calConfig: ContextModuleCalConfig) {
    this.config.cal = calConfig;
    return this;
  }

  /**
   * Add a custom metadata service configuration
   *
   * @param metadataServiceConfig
   * @returns this
   */
  setMetadataServiceConfig(
    metadataServiceConfig: ContextModuleMetadataServiceConfig,
  ) {
    this.config.metadataServiceDomain = metadataServiceConfig;
    return this;
  }

  /**
   * Add a custom web3 checks configuration
   *
   * @param web3ChecksConfig
   * @returns this
   */
  setWeb3ChecksConfig(web3ChecksConfig: ContextModuleWeb3ChecksConfig) {
    this.config.web3checks = web3ChecksConfig;
    return this;
  }

  /**
   * Add datasource configuration
   *
   * @param datasourceConfig
   * @returns this
   */
  setDatasourceConfig(datasourceConfig: ContextModuleDatasourceConfig) {
    this.config.datasource = datasourceConfig;
    return this;
  }

  /**
   * Set a custom reporter configuration
   *
   * @param reporterConfig
   * @returns this
   */
  setReporterConfig(reporterConfig: ContextModuleReporterConfig) {
    this.config.reporter = reporterConfig;
    return this;
  }

  /**
   * Set a custom blind signing reporter
   *
   * @param reporter reporter to use for blind signing events
   * @returns this
   */
  setBlindSigningReporter(reporter: BlindSigningReporter) {
    this.config.customBlindSigningReporter = reporter;
    return this;
  }

  /**
   * Set a custom trusted name data source
   *
   * @param dataSource data source to use for trusted name resolution
   * @returns this
   */
  setTrustedNameDataSource(dataSource: TrustedNameDataSource) {
    this.config.customTrustedNameDataSource = dataSource;
    return this;
  }

  /**
   * Set a custom logger factory
   *
   * @param loggerFactory
   * @returns this
   */
  setLoggerFactory(loggerFactory: (tag: string) => LoggerPublisherService) {
    this.config.loggerFactory = loggerFactory;
    return this;
  }

  /**
   * Build the context module
   *
   * @returns the context module
   */
  build(): ContextModule {
    return new DefaultContextModule(resolveConfig(this.config));
  }
}
