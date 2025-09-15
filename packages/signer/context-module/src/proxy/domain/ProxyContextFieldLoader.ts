import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { type ProxyDelegateCall } from "@/proxy/model/ProxyDelegateCall";
import {
  type ContextFieldLoader,
  ContextFieldLoaderKind,
} from "@/shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type TransactionFieldContext } from "@/shared/model/TransactionFieldContext";

@injectable()
export class ProxyContextFieldLoader
  implements ContextFieldLoader<ContextFieldLoaderKind.PROXY_DELEGATE_CALL>
{
  kind: ContextFieldLoaderKind.PROXY_DELEGATE_CALL =
    ContextFieldLoaderKind.PROXY_DELEGATE_CALL;

  constructor(
    @inject(proxyTypes.ProxyDataSource)
    private _proxyDataSource: ProxyDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private _certificateLoader: PkiCertificateLoader,
  ) {}

  async loadField(
    field: TransactionFieldContext<ContextFieldLoaderKind.PROXY_DELEGATE_CALL>,
  ): Promise<ClearSignContext> {
    const proxyDelegateCall = await this._proxyDataSource.getProxyDelegateCall({
      calldata: field.calldata,
      proxyAddress: field.proxyAddress,
      chainId: field.chainId,
      challenge: field.challenge,
    });

    return proxyDelegateCall.caseOf<Promise<ClearSignContext>>({
      Left: (error) =>
        Promise.resolve({
          type: ClearSignContextType.ERROR,
          error: error,
        }),
      Right: async ({ signedDescriptor }: ProxyDelegateCall) => {
        const certificate = await this._certificateLoader.loadCertificate({
          keyId: KeyId.CalCalldataKey,
          keyUsage: KeyUsage.Calldata,
          targetDevice: field.deviceModelId,
        });

        return {
          type: ClearSignContextType.PROXY_DELEGATE_CALL,
          payload: signedDescriptor,
          certificate,
        };
      },
    });
  }
}
