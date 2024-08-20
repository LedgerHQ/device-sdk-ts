import { externalPluginTypes } from "@/external-plugin/di/externalPluginTypes";
import { forwardDomainTypes } from "@/forward-domain/di/forwardDomainTypes";
import { nftTypes } from "@/nft/di/nftTypes";
import { tokenTypes } from "@/token/di/tokenTypes";
import { typedDataTypes } from "@/typed-data/di/typedDataTypes";

import { ExternalPluginContextLoader } from "./external-plugin/domain/ExternalPluginContextLoader";
import { ForwardDomainContextLoader } from "./forward-domain/domain/ForwardDomainContextLoader";
import { NftContextLoader } from "./nft/domain/NftContextLoader";
import { ContextLoader } from "./shared/domain/ContextLoader";
import { TokenContextLoader } from "./token/domain/TokenContextLoader";
import { type TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { ContextModule } from "./ContextModule";
import { DefaultContextModule } from "./DefaultContextModule";
import { makeContainer } from "./di";

export class ContextModuleBuilder {
  private customLoaders: ContextLoader[] = [];
  private defaultLoaders: ContextLoader[] = [];
  private typedDataLoader: TypedDataContextLoader;

  constructor() {
    const container = makeContainer();

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
    this.typedDataLoader = container.get<TypedDataContextLoader>(
      typedDataTypes.TypedDataContextLoader,
    );
  }

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
    this.typedDataLoader = loader;
    return this;
  }

  /**
   * Build the context module
   *
   * @returns the context module
   */
  build(): ContextModule {
    const loaders = [...this.defaultLoaders, ...this.customLoaders];
    return new DefaultContextModule({
      loaders,
      typedDataLoader: this.typedDataLoader,
    });
  }
}
