import {
  DeviceModelId,
  HexaString,
  isHexaString,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import type {
  GetSafeAccountResponse,
  SafeAccountDataSource,
} from "@/safe/data/SafeAccountDataSource";
import { safeTypes } from "@/safe/di/safeTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type SafeAddressContextInput = {
  safeContractAddress: HexaString;
  chainId: number;
  deviceModelId: DeviceModelId;
  challenge: string;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SAFE,
  ClearSignContextType.SIGNER,
];

@injectable()
export class SafeAddressLoader
  implements ContextLoader<SafeAddressContextInput>
{
  constructor(
    @inject(safeTypes.SafeAddressDataSource)
    private readonly _dataSource: SafeAccountDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
  ) {}

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SafeAddressContextInput {
    return (
      expectedTypes.every((type) => SUPPORTED_TYPES.includes(type)) &&
      typeof input === "object" &&
      input !== null &&
      "safeContractAddress" in input &&
      isHexaString(input.safeContractAddress) &&
      input.safeContractAddress !== "0x" &&
      "chainId" in input &&
      typeof input.chainId === "number" &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      "challenge" in input &&
      typeof input.challenge === "string" &&
      input.challenge.length > 0
    );
  }

  async load({
    safeContractAddress,
    chainId,
    deviceModelId,
    challenge,
  }: SafeAddressContextInput): Promise<ClearSignContext[]> {
    const descriptors = await this._dataSource.getDescriptors({
      safeContractAddress,
      chainId,
      challenge,
    });

    return descriptors.caseOf({
      Left: (error): Promise<ClearSignContext[]> =>
        Promise.resolve([
          {
            type: ClearSignContextType.ERROR,
            error,
          },
        ]),
      Right: async ({
        account,
        signers,
      }: GetSafeAccountResponse): Promise<ClearSignContext[]> => [
        {
          type: ClearSignContextType.SAFE,
          payload: account.signedDescriptor,
          certificate: await this._certificateLoader.loadCertificate({
            keyId: account.keyId,
            keyUsage: account.keyUsage,
            targetDevice: deviceModelId,
          }),
        },
        {
          type: ClearSignContextType.SIGNER,
          payload: signers.signedDescriptor,
          certificate: await this._certificateLoader.loadCertificate({
            keyId: signers.keyId,
            keyUsage: signers.keyUsage,
            targetDevice: deviceModelId,
          }),
        },
      ],
    });
  }
}
