import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type Signature } from "@api/index";
import { SignOffChainMessageCommand } from "@internal/app-binder/command/SignOffChainMessageCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

export type SendSignMessageTaskArgs = {
  sendingData: Uint8Array;
  derivationPath: string;
};

export type SendSignMessageTaskRunFunctionReturn = Promise<
  CommandResult<Signature, SolanaAppErrorCodes>
>;

export class SendSignMessageTask {
  constructor(
    private api: InternalApi,
    private args: SendSignMessageTaskArgs,
  ) {}

  async run(): SendSignMessageTaskRunFunctionReturn {
    const { sendingData, derivationPath } = this.args;

    const commandBuffer = this._buildApduCommand(
      this._buildFullMessage(sendingData),
      DerivationPathUtils.splitPath(derivationPath),
    );

    if (commandBuffer.length > APDU_MAX_PAYLOAD) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "The APDU command exceeds the maximum allowable size (255 bytes)",
        ),
      });
    }

    return await this.api.sendCommand(
      new SignOffChainMessageCommand({
        message: commandBuffer,
        derivationPath,
      }),
    );
  }

  private _buildFullMessage(sendingData: Uint8Array): Uint8Array {
    const prefix = new TextEncoder().encode("solana offchain");
    const msgLengthFieldSize = 4;

    const lengthBytes = new Uint8Array(msgLengthFieldSize);
    lengthBytes[2] = sendingData.length;

    const fullMessage = new Uint8Array(
      1 + prefix.length + lengthBytes.length + sendingData.length,
    );

    let offset = 0;
    fullMessage[offset++] = 0xff;
    fullMessage.set(prefix, offset);
    offset += prefix.length;
    fullMessage.set(lengthBytes, offset);
    offset += lengthBytes.length;
    fullMessage.set(sendingData, offset);

    return fullMessage;
  }

  private _buildApduCommand(
    fullMessage: Uint8Array,
    paths: number[],
  ): Uint8Array {
    const numberOfSigners = 1;
    const pathSize = 4;
    const signersCountSize = 1;
    const derivationsCountSize = 1;
    const numberOfDerivations = paths.length;
    const builder = new ByteArrayBuilder(
      fullMessage.length +
        signersCountSize +
        derivationsCountSize +
        numberOfDerivations * pathSize,
    );

    builder.add8BitUIntToData(numberOfSigners);
    builder.add8BitUIntToData(numberOfDerivations);

    paths.forEach((path) => {
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setUint32(0, path, false);
      builder.addBufferToData(buffer);
    });

    builder.addBufferToData(fullMessage);
    return builder.build();
  }
}
