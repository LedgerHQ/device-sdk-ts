import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { type ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import {
  ProxyContextFieldLoader,
  ProxyFieldInput,
} from "@/proxy/domain/ProxyContextFieldLoader";
import { SupportedChainIds } from "@/safe/constant/SupportedChainIds";
import { safeTypes } from "@/safe/di/safeTypes";
import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

@injectable()
export class SafeProxyContextFieldLoader
  implements ContextFieldLoader<ProxyFieldInput>
{
  private readonly proxyFieldLoader: ProxyContextFieldLoader;

  constructor(
    @inject(safeTypes.SafeProxyDataSource)
    private readonly proxyDataSource: ProxyDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
  ) {
    this.proxyFieldLoader = new ProxyContextFieldLoader(
      this.proxyDataSource,
      this.certificateLoader,
    );
  }

  canHandle(field: unknown) {
    return this.proxyFieldLoader.canHandle(field);
  }

  async loadField(field: ProxyFieldInput): Promise<ClearSignContext> {
    if (!Object.values(SupportedChainIds).includes(field.chainId)) {
      return {
        type: ClearSignContextType.ERROR,
        error: new Error("Invalid chain id"),
      };
    }

    return this.proxyFieldLoader.loadField(field);
  }
}
