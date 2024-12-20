import {
  type ContextModuleCalConfig,
  type ContextModuleConfig,
} from "./config/model/ContextModuleConfig";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import { type TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { type ContextModule } from "./ContextModule";
import { DefaultContextModule } from "./DefaultContextModule";

const DEFAULT_CAL_URL = "https://crypto-assets-service.api.ledger.com/v1";

export const DEFAULT_CONFIG: ContextModuleConfig = {
  cal: {
    url: DEFAULT_CAL_URL,
    mode: "prod",
    branch: "main",
  },
  defaultLoaders: true,
  customLoaders: [],
  customTypedDataLoader: undefined,
};

export class ContextModuleBuilder {
  private config: ContextModuleConfig = DEFAULT_CONFIG;

  constructor() {}

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
  addCalConfig(calConfig: ContextModuleCalConfig) {
    this.config.cal = { ...DEFAULT_CONFIG.cal, ...calConfig };
    return this;
  }

  /**
   * Build the context module
   *
   * @returns the context module
   */
  build(): ContextModule {
    return new DefaultContextModule(this.config);
  }
}
