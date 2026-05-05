import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/loaders/chain-agnostic/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/loaders/chain-agnostic/pki/domain/PkiCertificateLoader";
import { type ProxyDataSource } from "@/loaders/ethereum/proxy/data/ProxyDataSource";
import { ethereumProxyTypes } from "@/loaders/ethereum/proxy/di/ethereumProxyTypes";
import { type ProxyDelegateCall } from "@/loaders/ethereum/proxy/model/ProxyDelegateCall";
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
    @inject(ethereumProxyTypes.EthereumProxyDataSource)
    private _proxyDataSource: ProxyDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private _certificateLoader: PkiCertificateLoader,
  ) {}

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType,
  ): input is ProxyFieldInput {
    return (
      expectedType === ClearSignContextType.ETHEREUM_PROXY_INFO &&
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
      Right: async ({
        signedDescriptor,
        keyId,
        keyUsage,
      }: ProxyDelegateCall) => {
        const certificate = await this._certificateLoader.loadCertificate({
          keyId,
          keyUsage,
          targetDevice: input.deviceModelId,
        });

        return {
          type: ClearSignContextType.ETHEREUM_PROXY_INFO,
          payload: signedDescriptor,
          certificate,
        };
      },
    });
  }
}
