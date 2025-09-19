import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { type ProxyDelegateCall } from "@/proxy/model/ProxyDelegateCall";
import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

type ProxyFieldInput = {
  chainId: number;
  proxyAddress: string;
  calldata: string;
  challenge: string;
  deviceModelId: DeviceModelId;
};

@injectable()
export class ProxyContextFieldLoader
  implements ContextFieldLoader<ProxyFieldInput>
{
  constructor(
    @inject(proxyTypes.ProxyDataSource)
    private _proxyDataSource: ProxyDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private _certificateLoader: PkiCertificateLoader,
  ) {}

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType,
  ): input is ProxyFieldInput {
    return (
      expectedType === ClearSignContextType.PROXY_DELEGATE_CALL &&
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "proxyAddress" in input &&
      "calldata" in input &&
      "challenge" in input &&
      "deviceModelId" in input
    );
  }

  async loadField(input: ProxyFieldInput): Promise<ClearSignContext> {
    const proxyDelegateCall =
      await this._proxyDataSource.getProxyImplementationAddress({
        calldata: input.calldata,
        proxyAddress: input.proxyAddress,
        chainId: input.chainId,
        challenge: input.challenge,
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
          targetDevice: input.deviceModelId,
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
