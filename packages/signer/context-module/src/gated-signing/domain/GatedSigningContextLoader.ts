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
    const result = await this._dataSource.getGatedDescriptor({
      contractAddress: to,
      selector,
      chainId,
    });

    return result.caseOf({
      Left: (error): Promise<ClearSignContext[]> =>
        Promise.resolve([
          {
            type: ClearSignContextType.ERROR,
            error,
          },
        ]),
      Right: async ({ signedDescriptor }): Promise<ClearSignContext[]> => [
        {
          type: ClearSignContextType.GATED_SIGNING,
          payload: signedDescriptor,
          certificate: await this._certificateLoader.loadCertificate({
            keyId: KeyId.CalGatedSigning,
            keyUsage: KeyUsage.GatedSigning,
            targetDevice: deviceModelId,
          }),
        },
      ],
    });
  }
}
