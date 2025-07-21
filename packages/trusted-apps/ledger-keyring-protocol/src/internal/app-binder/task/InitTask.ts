import {
  CommandResultStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { type Keypair } from "@api/index";
import { InitCommand } from "@internal/app-binder/command/InitCommand";
import { type LKKPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { CryptoUtils } from "@internal/utils/crypto";

export class InitTask {
  constructor(private readonly api: InternalApi) {}

  async run(): Promise<Either<LKKPDeviceCommandError, Keypair>> {
    const sessionKeypair = CryptoUtils.randomKeypair();
    const response = await this.api.sendCommand(
      new InitCommand(sessionKeypair),
    );

    return response.status !== CommandResultStatus.Success
      ? Left(response.error)
      : Right(sessionKeypair);
  }
}
