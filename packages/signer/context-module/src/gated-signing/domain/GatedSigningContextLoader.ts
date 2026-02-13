import {
  DeviceModelId,
  HexaString,
  isHexaString,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GatedDescriptorDataSource } from "@/gated-signing/data/GatedDescriptorDataSource";
import { gatedSigningTypes } from "@/gated-signing/di/gatedSigningTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type GatedSigningContextInput = {
  to: HexaString;
  selector: HexaString;
  chainId: number;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.GATED_SIGNING,
];

@injectable()
export class GatedSigningContextLoader
  implements ContextLoader<GatedSigningContextInput>
{
  constructor(
    @inject(gatedSigningTypes.GatedDescriptorDataSource)
    private readonly _dataSource: GatedDescriptorDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(proxyTypes.ProxyDataSource)
    private readonly _proxyDataSource: ProxyDataSource,
  ) {}

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is GatedSigningContextInput {
    return (
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type)) &&
      typeof input === "object" &&
      input !== null &&
      "to" in input &&
      isHexaString(input.to) &&
      input.to !== "0x" &&
      "selector" in input &&
      isHexaString(input.selector) &&
      "chainId" in input &&
      typeof input.chainId === "number" &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined
    );
  }

  async load({
    to,
    selector,
    chainId,
    deviceModelId,
  }: GatedSigningContextInput): Promise<ClearSignContext[]> {
    const directResult = await this._dataSource.getGatedDescriptor({
      contractAddress: to,
      selector,
      chainId,
    });

    if (directResult.isRight()) {
      const { signedDescriptor } = directResult.unsafeCoerce();
      const certificate = await this._certificateLoader.loadCertificate({
        keyId: KeyId.CalGatedSigning,
        keyUsage: KeyUsage.GatedSigning,
        targetDevice: deviceModelId,
      });
      return [
        {
          type: ClearSignContextType.GATED_SIGNING,
          payload: signedDescriptor,
          certificate,
        },
      ];
    }

    const firstError: Error = directResult.caseOf({
      Left: (error) => error,
      Right: () => new Error("unreachable"),
    });

    const proxyResult =
      await this._proxyDataSource.getProxyImplementationAddress({
        proxyAddress: to,
        chainId,
        challenge: "",
        calldata: "0x",
      });

    if (proxyResult.isLeft()) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: firstError,
        },
      ];
    }

    const proxyData = proxyResult.unsafeCoerce();
    const implRaw = proxyData.implementationAddress.toLowerCase();
    const implementationAddress: HexaString = implRaw.startsWith("0x")
      ? (implRaw as HexaString)
      : (`0x${implRaw}` as HexaString);

    const implGatedResult = await this._dataSource.getGatedDescriptor({
      contractAddress: implementationAddress,
      selector,
      chainId,
    });

    if (implGatedResult.isLeft()) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: firstError,
        },
      ];
    }

    const { signedDescriptor } = implGatedResult.unsafeCoerce();
    const [proxyCertificate, gatedCertificate] = await Promise.all([
      this._certificateLoader.loadCertificate({
        keyId: proxyData.keyId,
        keyUsage: proxyData.keyUsage,
        targetDevice: deviceModelId,
      }),
      this._certificateLoader.loadCertificate({
        keyId: KeyId.CalGatedSigning,
        keyUsage: KeyUsage.GatedSigning,
        targetDevice: deviceModelId,
      }),
    ]);

    return [
      {
        type: ClearSignContextType.PROXY_INFO,
        payload: proxyData.signedDescriptor,
        certificate: proxyCertificate,
      },
      {
        type: ClearSignContextType.GATED_SIGNING,
        payload: signedDescriptor,
        certificate: gatedCertificate,
      },
    ];
  }
}
