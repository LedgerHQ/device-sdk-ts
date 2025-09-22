import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import bs58 from "bs58";

import { GetPubKeyCommand } from "@internal/app-binder/command/GetPubKeyCommand";
import {
  SignOffChainMessageCommand,
  type SignOffChainMessageCommandResponse,
} from "@internal/app-binder/command/SignOffChainMessageCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

export type SendSignMessageTaskArgs = {
  sendingData: Uint8Array;
  derivationPath: string;
};

export type SendSignMessageTaskRunFunctionReturn = Promise<
  CommandResult<SignOffChainMessageCommandResponse, SolanaAppErrorCodes>
>;

export const MAX_MESSAGE_LENGTH = 0xffff;

export class SendSignMessageTask {
  constructor(
    private api: InternalApi,
    private args: SendSignMessageTaskArgs,
  ) {}

  async run(): SendSignMessageTaskRunFunctionReturn {
    const { sendingData, derivationPath } = this.args;

    if (sendingData.length === 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Message cannot be empty"),
      });
    }

    if (sendingData.length > MAX_MESSAGE_LENGTH) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Message too long: ${sendingData.length} bytes (max is 65535)`,
        ),
      });
    }

    const pathIndexes = DerivationPathUtils.splitPath(derivationPath);

    const pubkeyResult = await this.api.sendCommand(
      new GetPubKeyCommand({ derivationPath, checkOnDevice: false }),
    );

    if (!("data" in pubkeyResult)) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Error getting public key from device",
        ),
      });
    }

    const signerPubkey = bs58.decode(pubkeyResult.data);
    const fullMessage = this._buildFullMessage(sendingData, signerPubkey);
    const commandBuffer = this._buildApduCommand(fullMessage, pathIndexes);

    if (commandBuffer.length > APDU_MAX_PAYLOAD) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "The APDU command exceeds the maximum allowable size (255 bytes)",
        ),
      });
    }

    return this.api.sendCommand(
      new SignOffChainMessageCommand({ message: commandBuffer }),
    );
  }

  /**
   * builds the serialised off-chain message header and body
   */
  private _buildFullMessage(
    sendingData: Uint8Array,
    signerPubkey: Uint8Array,
  ): Uint8Array {
    return (
      new ByteArrayBuilder()
        // 0xFF + prefix
        .add8BitUIntToData(0xff)
        .addAsciiStringToData("solana offchain")
        // version = 0
        .add8BitUIntToData(0)
        // domain = 32 zeros
        .addBufferToData(new Uint8Array(32))
        // format = 0
        .add8BitUIntToData(0)
        // signer count = 1
        .add8BitUIntToData(1)
        // signer pubkey (32 bytes)
        .addBufferToData(signerPubkey)
        // message length (2 bytes, little endian)
        .add8BitUIntToData(sendingData.length & 0xff)
        .add8BitUIntToData((sendingData.length >> 8) & 0xff)
        // message body
        .addBufferToData(sendingData)
        .build()
    );
  }

  /**
   * builds the APDU command to send to the device
   */
  private _buildApduCommand(
    fullMessage: Uint8Array,
    paths: number[],
  ): Uint8Array {
    const numberOfSigners = 1;
    const derivationCount = 1;
    const pathBytes = paths.length * 4;
    const builder = new ByteArrayBuilder(
      fullMessage.length + numberOfSigners + derivationCount + pathBytes,
    );

    // number of signers
    builder.add8BitUIntToData(numberOfSigners);
    // number of BIP32 derivations
    builder.add8BitUIntToData(paths.length);
    // each derivation index
    paths.forEach((idx) => {
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setUint32(0, idx, false);
      builder.addBufferToData(buf);
    });
    // serialised off-chain message
    builder.addBufferToData(fullMessage);

    return builder.build();
  }
}
