import { type ContextModuleConstructorArgs } from "./config/model/ContextModuleBuildArgs";
import {
  type ContextModuleCalConfig,
  type ContextModuleConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleWeb3ChecksConfig,
} from "./config/model/ContextModuleConfig";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import { type SolanaContextLoader } from "./solana/domain/SolanaContextLoader";
import { type TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { type Web3CheckContextLoader } from "./web3-check/domain/Web3CheckContextLoader";
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
};

export class ContextModuleBuilder {
  private config: ContextModuleConfig = DEFAULT_CONFIG;
  private needOriginToken: boolean = true;
  private originToken?: string;

  constructor({ originToken }: ContextModuleConstructorArgs = {}) {
    this.originToken = originToken;
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
   * Replace the default loader for web3 checks
   *
   * @param loader loader to use for web3 checks
   * @returns this
   */
  addWeb3CheckLoader(loader: Web3CheckContextLoader) {
    this.needOriginToken = false;
    this.config.customWeb3CheckLoader = loader;
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
   * Build the context module
   *
   * @returns the context module
   */
  build(): ContextModule {
    if (this.needOriginToken && !this.originToken) {
      throw new Error("Origin token is required");
    }

    const config = { ...this.config, originToken: this.originToken };
    return new DefaultContextModule(config);
  }
}
