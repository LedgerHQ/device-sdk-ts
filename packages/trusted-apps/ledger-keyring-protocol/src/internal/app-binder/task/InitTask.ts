import {
  CommandResultStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { type CryptoService, Curve } from "@api/crypto/CryptoService";
import { type KeyPair } from "@api/crypto/KeyPair";
import { InitCommand } from "@internal/app-binder/command/InitCommand";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyRingProtocolErrors";

export class InitTask {
  constructor(
    private readonly api: InternalApi,
    private readonly cryptoService: CryptoService,
  ) {}

  async run(): Promise<Either<LKRPDeviceCommandError, KeyPair>> {
    const sessionKeypair = await this.cryptoService.createKeyPair(Curve.K256);
    const response = await this.api.sendCommand(
      new InitCommand({ publicKey: sessionKeypair.getPublicKey() }),
    );

    return response.status !== CommandResultStatus.Success
      ? Left(response.error)
      : Right(sessionKeypair);
  }
}
