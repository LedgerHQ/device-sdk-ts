import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import type { ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { SupportedChainIds } from "@/safe/constant/SupportedChainIds";
import { safeTypes } from "@/safe/di/safeTypes";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import type { TypedDataClearSignContext } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";
import type { TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import { typedDataTypes } from "@/typed-data/di/typedDataTypes";
import { DefaultTypedDataContextLoader } from "@/typed-data/domain/DefaultTypedDataContextLoader";
import type { TypedDataContextLoader } from "@/typed-data/domain/TypedDataContextLoader";

@injectable()
export class SafeTypedDataContextLoader implements TypedDataContextLoader {
  private readonly typedDataContextLoader: TypedDataContextLoader;

  constructor(
    @inject(typedDataTypes.TypedDataDataSource)
    private typedDataDataSource: TypedDataDataSource,
    @inject(tokenTypes.TokenDataSource)
    private tokenDataSource: TokenDataSource,
    @inject(safeTypes.SafeProxyDataSource)
    private proxyDataSource: ProxyDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private certificateLoader: PkiCertificateLoader,
  ) {
    this.typedDataContextLoader = new DefaultTypedDataContextLoader(
      this.typedDataDataSource,
      this.tokenDataSource,
      this.proxyDataSource,
      this.certificateLoader,
    );
  }

  async load(ctx: TypedDataContext): Promise<TypedDataClearSignContext> {
    if (!Object.values(SupportedChainIds).includes(ctx.chainId)) {
      return {
        type: ClearSignContextType.ERROR,
        error: new Error("Invalid chain id"),
      };
    }
    return this.typedDataContextLoader.load(ctx);
  }
}
