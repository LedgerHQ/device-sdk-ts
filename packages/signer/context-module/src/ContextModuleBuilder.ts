import { externalPluginTypes } from "@/external-plugin/di/externalPluginTypes";
import { forwardDomainTypes } from "@/forward-domain/di/forwardDomainTypes";
import { nftTypes } from "@/nft/di/nftTypes";
import { tokenTypes } from "@/token/di/tokenTypes";
import { typedDataTypes } from "@/typed-data/di/typedDataTypes";

import { type ContextModuleConfig } from "./config/model/ContextModuleConfig";
import { type ExternalPluginContextLoader } from "./external-plugin/domain/ExternalPluginContextLoader";
import { type ForwardDomainContextLoader } from "./forward-domain/domain/ForwardDomainContextLoader";
import { type NftContextLoader } from "./nft/domain/NftContextLoader";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import { type TokenContextLoader } from "./token/domain/TokenContextLoader";
import { type TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { type ContextModule } from "./ContextModule";
import { DefaultContextModule } from "./DefaultContextModule";
import { makeContainer } from "./di";

const DEFAULT_CAL_URL = "https://crypto-assets-service.api.ledger.com/v1";

export const DEFAULT_CONFIG: ContextModuleConfig = {
  cal: {
    url: DEFAULT_CAL_URL,
    mode: "prod",
    branch: "main",
  },
};

export class ContextModuleBuilder {
  private config: Partial<ContextModuleConfig> = {};
  private customLoaders: ContextLoader[] = [];
  private defaultLoaders: ContextLoader[] = [];
  private customTypedDataLoader?: TypedDataContextLoader;

  constructor() {}

  /**
   * Remove default loaders from the list of loaders
   *
   * @returns this
   */
  withoutDefaultLoaders() {
    this.defaultLoaders = [];
    return this;
  }

  /**
   * Add a custom loader to the list of loaders
   *
   * @param loader loader to add to the list of loaders
   * @returns this
   */
  addLoader(loader: ContextLoader) {
    this.customLoaders.push(loader);
    return this;
  }

  /**
   * Replace the default loader for typed data clear signing contexts
   *
   * @returns this
   */
  withTypedDataLoader(loader: TypedDataContextLoader) {
    this.customTypedDataLoader = loader;
    return this;
  }

  /**
   * Set the configuration for the context module
   *
   * @param config configuration for the context module
   * @returns this
   */
  withConfig(config: Partial<ContextModuleConfig>) {
    this.config = config;
    return this;
  }

  /**
   * Build the context module
   *
   * @returns the context module
   */
  build(): ContextModule {
    const container = makeContainer({
      config: { ...DEFAULT_CONFIG, ...this.config },
    });

    this.defaultLoaders = [
      container.get<ExternalPluginContextLoader>(
        externalPluginTypes.ExternalPluginContextLoader,
      ),
      container.get<ForwardDomainContextLoader>(
        forwardDomainTypes.ForwardDomainContextLoader,
      ),
      container.get<NftContextLoader>(nftTypes.NftContextLoader),
      container.get<TokenContextLoader>(tokenTypes.TokenContextLoader),
    ];
    const defaultTypedDataLoader = container.get<TypedDataContextLoader>(
      typedDataTypes.TypedDataContextLoader,
    );

    const loaders = [...this.defaultLoaders, ...this.customLoaders];
    return new DefaultContextModule({
      loaders,
      typedDataLoader: this.customTypedDataLoader ?? defaultTypedDataLoader,
    });
  }
}
