import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/modules/chain-agnostic/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/chain-agnostic/pki/domain/PkiCertificateLoader";
import type {
  AccountOwnershipDataSource,
  AccountOwnershipNetwork,
} from "@/modules/concordium/account-ownership/data/AccountOwnershipDataSource";
import { concordiumAccountOwnershipTypes } from "@/modules/concordium/account-ownership/di/concordiumAccountOwnershipTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type AccountOwnershipContextInput = {
  publicKey: string;
  address: string;
  network: AccountOwnershipNetwork;
  deviceModelId: DeviceModelId;
  challenge: string;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.CONCORDIUM_ACCOUNT_OWNERSHIP,
];

@injectable()
export class AccountOwnershipContextLoader
  implements ContextLoader<AccountOwnershipContextInput>
{
  constructor(
    @inject(
      concordiumAccountOwnershipTypes.ConcordiumAccountOwnershipDataSource,
    )
    private readonly _dataSource: AccountOwnershipDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
  ) {}

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is AccountOwnershipContextInput {
    return (
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type)) &&
      typeof input === "object" &&
      input !== null &&
      "publicKey" in input &&
      typeof input.publicKey === "string" &&
      input.publicKey.length > 0 &&
      "address" in input &&
      typeof input.address === "string" &&
      input.address.length > 0 &&
      "network" in input &&
      (input.network === "mainnet" || input.network === "testnet") &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      "challenge" in input &&
      typeof input.challenge === "string" &&
      input.challenge.length > 0
    );
  }

  async load({
    publicKey,
    address,
    network,
    deviceModelId,
    challenge,
  }: AccountOwnershipContextInput): Promise<ClearSignContext[]> {
    const descriptor = await this._dataSource.getDescriptor({
      publicKey,
      address,
      challenge,
      network,
    });

    return descriptor.caseOf({
      Left: (error): Promise<ClearSignContext[]> =>
        Promise.resolve([
          {
            type: ClearSignContextType.ERROR,
            error,
          },
        ]),
      Right: async (result): Promise<ClearSignContext[]> => [
        {
          type: ClearSignContextType.CONCORDIUM_ACCOUNT_OWNERSHIP,
          payload: result.signedDescriptor,
          certificate: await this._certificateLoader.loadCertificate({
            keyId: result.keyId,
            keyUsage: result.keyUsage,
            targetDevice: deviceModelId,
          }),
        },
      ],
    });
  }
}
