import {
  DeviceModelId,
  HexaString,
  isHexaString,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/loaders/chain-agnostic/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/loaders/chain-agnostic/pki/domain/PkiCertificateLoader";
import type {
  GetSafeAccountResponse,
  SafeAccountDataSource,
} from "@/loaders/ethereum/safe/data/SafeAccountDataSource";
import { ethereumSafeTypes } from "@/loaders/ethereum/safe/di/ethereumSafeTypes";
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
  ClearSignContextType.ETHEREUM_SAFE,
  ClearSignContextType.ETHEREUM_SIGNER,
];

@injectable()
export class SafeAddressLoader
  implements ContextLoader<SafeAddressContextInput>
{
  constructor(
    @inject(ethereumSafeTypes.EthereumSafeAddressDataSource)
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
          type: ClearSignContextType.ETHEREUM_SAFE,
          payload: account.signedDescriptor,
          certificate: await this._certificateLoader.loadCertificate({
            keyId: account.keyId,
            keyUsage: account.keyUsage,
            targetDevice: deviceModelId,
          }),
        },
        {
          type: ClearSignContextType.ETHEREUM_SIGNER,
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
