import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { type ContextModuleConstructorArgs } from "./config/model/ContextModuleBuildArgs";
import {
  type ContextModuleCalConfig,
  type ContextModuleConfig,
  type ContextModuleDatasourceConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleWeb3ChecksConfig,
} from "./config/model/ContextModuleConfig";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import { NullLoggerFactory } from "./shared/utils/NullLoggerFactory";
import { type SolanaContextLoader } from "./solana/domain/SolanaContextLoader";
import { type TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { type ContextModule } from "./ContextModule";
import { DefaultContextModule } from "./DefaultContextModule";

const DEFAULT_CAL_URL = "https://crypto-assets-service.api.ledger.com/v1";
const DEFAULT_WEB3_CHECKS_URL = "https://web3checks-backend.api.ledger.com/v3";
const DEFAULT_METADATA_SERVICE_DOMAIN = "https://nft.api.live.ledger.com";

export const DEFAULT_CONFIG: ContextModuleConfig = {
  cal: {
    url: DEFAULT_CAL_URL,
    mode: "prod",
    branch: "main",
  },
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
  loggerFactory: NullLoggerFactory,
};

export class ContextModuleBuilder {
  private config: ContextModuleConfig = DEFAULT_CONFIG;
  private originToken?: string;

  constructor({
    originToken,
    loggerFactory,
  }: ContextModuleConstructorArgs = {}) {
    this.originToken = originToken;

    if (loggerFactory) {
      this.config.loggerFactory = loggerFactory;
    }
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
    const config = { ...this.config, originToken: this.originToken };
    return new DefaultContextModule(config);
  }
}
