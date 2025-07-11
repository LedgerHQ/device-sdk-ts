import {
  CommandResultStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { GetSeedIdCommand } from "@internal/app-binder/command/GetSeedIdCommand";
import { type LKKPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import {
  type AuthenticationPayload,
  type Challenge,
} from "@internal/lkrp-datasource/data/LKRPDataSource";

export class SignChallengeWithDeviceTask {
  constructor(private readonly api: InternalApi) {}

  async run(
    challenge: Challenge,
  ): Promise<Either<LKKPDeviceCommandError, AuthenticationPayload>> {
    const response = await this.api.sendCommand(
      new GetSeedIdCommand({ challengeTLV: challenge.tlv }),
    );

    if (response.status !== CommandResultStatus.Success) {
      return Left(response.error);
    }

    const { credential, signature, attestation } = response.data;
    return Right({
      challenge: challenge.json,
      signature: { credential, signature, attestation },
    });
  }
}
