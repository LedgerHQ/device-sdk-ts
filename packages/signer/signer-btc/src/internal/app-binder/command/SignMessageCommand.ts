import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { encodeVarint } from "@internal/utils/Varint";

import {
  BTC_APP_ERRORS,
  BtcAppCommandErrorFactory,
  type BtcErrorCodes,
} from "./utils/bitcoinAppErrors";

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

export class SignMessageCommand
  implements
    Command<SignMessageCommandResponse, SignMessageCommandArgs, BtcErrorCodes>
{
  readonly name = "signMessage";
  constructor(
    private readonly _args: SignMessageCommandArgs,
    private readonly _errorHelper = new CommandErrorHelper<
      SignMessageCommandResponse,
      BtcErrorCodes
    >(
      BTC_APP_ERRORS,
      BtcAppCommandErrorFactory,
      BtcCommandUtils.isSuccessResponse,
    ),
  ) {}

  getApdu(): Apdu {
    const { derivationPath, messageLength, messageMerkleRoot } = this._args;

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

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, BtcErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: apduResponse }));
  }
}
