import {
  type LoggerPublisherService,
  noopLoggerFactory,
} from "@ledgerhq/device-management-kit";

import { type ContextModuleConstructorArgs } from "./config/model/ContextModuleBuildArgs";
import {
  type ContextModuleCalConfig,
  type ContextModuleConfig,
  type ContextModuleDatasourceConfig,
  type ContextModuleLoaderConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleReporterConfig,
  type ContextModuleServiceConfig,
  type ContextModuleWeb3ChecksConfig,
} from "./config/model/ContextModuleConfig";
import { type ContactsDataSource } from "./modules/ethereum/contacts/domain/ContactsDataSource";
import { type TrustedNameDataSource } from "./modules/ethereum/trusted-name/data/TrustedNameDataSource";
import { type TypedDataContextLoader } from "./modules/ethereum/typed-data/domain/TypedDataContextLoader";
import { type BlindSigningReporter } from "./modules/multichain/reporter/domain/BlindSigningReporter";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import { type ContextModuleChainID } from "./shared/domain/ContextModuleChainID";
import { type ContextModule } from "./ContextModule";
import { DefaultContextModule } from "./DefaultContextModule";

const DEFAULT_CAL_URL = "https://crypto-assets-service.api.ledger.com/v1";
const DEFAULT_WEB3_CHECKS_URL = "https://web3checks-backend.api.ledger.com/v3";
const DEFAULT_METADATA_SERVICE_DOMAIN = "https://nft.api.live.ledger.com";
const DEFAULT_REPORTER_URL = "https://blind-signing.api.ledger.com/ingest/v1";

/**
 * Default configuration for the context module
 *
 * @note This configuration is frozen to prevent modifications after construction
 * and can be used by external packages to get a default configuration.
 */
export const DEFAULT_CONFIG: Readonly<ContextModuleConfig> = Object.freeze({
  cal: Object.freeze({
    url: DEFAULT_CAL_URL,
    mode: "prod",
    branch: "main",
  }),
  web3checks: Object.freeze({
    url: DEFAULT_WEB3_CHECKS_URL,
  }),
  metadataServiceDomain: Object.freeze({
    url: DEFAULT_METADATA_SERVICE_DOMAIN,
  }),
  reporter: Object.freeze({
    url: DEFAULT_REPORTER_URL,
  }),
  datasource: Object.freeze({ proxy: "default" }),
  appSource: "third-party",
});

/**
 * Default loader configuration for the context module
 *
 * @note This configuration is internal and will be the default configuration for the context module.
 */
const DEFAULT_LOADER_CONFIG: ContextModuleLoaderConfig = {
  defaultLoaders: true,
  defaultFieldLoaders: true,
  customLoaders: [],
  customFieldLoaders: [],
  customTypedDataLoader: undefined,
  customBlindSigningReporter: undefined,
  customTrustedNameDataSource: undefined,
  customContactsDataSource: undefined,
};

// Internal config type: all ServiceConfig fields except chain (set later via setChain)
type BuilderConfig = Omit<ContextModuleServiceConfig, "chain"> &
  Partial<Pick<ContextModuleServiceConfig, "chain">> &
  ContextModuleLoaderConfig;

export class ContextModuleBuilder {
  private config: BuilderConfig;

  constructor({ originToken, loggerFactory }: ContextModuleConstructorArgs) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...DEFAULT_LOADER_CONFIG,
      customLoaders: [],
      customFieldLoaders: [],
      originToken: originToken ?? "",
      loggerFactory: loggerFactory ?? noopLoggerFactory,
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
   * Set the app source identifier included in blind signing reports
   *
   * @param appSource
   * @returns this
   */
  setAppSource(appSource: string) {
    this.config.appSource = appSource;
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
   * Set a custom contacts data source.
   *
   * Contacts is local-first (the SDK does not ship a default
   * implementation). When set, `ContextModule.getContexts(tx)` will
   * auto-decorate `tx.from` / `tx.to` with the matching
   * `provideLedgerAccount` / `provideContact` APDUs during
   * `signTransaction`. When unset, no contacts decoration happens —
   * other metadata channels (ENS, ERC-7730, web3-check) are
   * unaffected.
   *
   * @param dataSource data source to use for contacts resolution
   * @returns this
   */
  setContactsDataSource(dataSource: ContactsDataSource) {
    this.config.customContactsDataSource = dataSource;
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
   * Set the chain for which this context module is built
   *
   * @param chain
   * @returns this
   */
  setChain(chain: ContextModuleChainID) {
    this.config.chain = chain;
    return this;
  }

  /**
   * Build the context module
   *
   * @returns the context module
   */
  build(): ContextModule {
    if (!this.config.chain) {
      throw new Error(
        "[ContextModuleBuilder] setChain() must be called before build()",
      );
    }
    return new DefaultContextModule(
      this.config as ContextModuleServiceConfig & ContextModuleLoaderConfig,
    );
  }
}
