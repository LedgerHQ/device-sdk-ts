import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";
import { encodeVarint } from "@internal/utils/Varint";

import { type BitcoinAppErrorCodes } from "./utils/bitcoinAppErrors";
import { BtcCommand } from "./utils/BtcCommand";

export type SignMessageCommandArgs = {
  /**
   * The BIP32 path (e.g., "m/44'/0'/0'/0/0")
   */
  readonly derivationPath: string;
  /**
   * The total length of the message to be signed
   */
  readonly messageLength: number;
  /**
   * The Merkle root of the message data
   */
  readonly messageMerkleRoot: Uint8Array;
};

export type SignMessageCommandResponse = ApduResponse;

export class SignMessageCommand extends BtcCommand<
  SignMessageCommandResponse,
  SignMessageCommandArgs
> {
  readonly args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    super();
    this.args = args;
  }

  override getApdu(): Apdu {
    const { derivationPath, messageLength, messageMerkleRoot } = this.args;

    const builder = new ApduBuilder({
      cla: 0xe1,
      ins: 0x10,
      p1: 0x00,
      p2: PROTOCOL_VERSION,
    });

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder
      .addBufferToData(encodeVarint(messageLength).unsafeCoerce()) // Message length (varint)
      .addBufferToData(messageMerkleRoot)
      .build();
  }

  override parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, BitcoinAppErrorCodes> {
    return this._getError(apduResponse).orDefault(
      CommandResultFactory({ data: apduResponse }),
    );
  }
}
