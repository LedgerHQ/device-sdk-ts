// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#sign-eth-personal-message
import {
  Apdu,
  ApduBuilder,
  ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  Command,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";
import { Just, Maybe, Nothing } from "purify-ts";

import { Signature } from "@api/model/Signature";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const MAX_CHUNK_SIZE = 150;
const PATH_SIZE = 4;
const MESSAGE_LENGTH_SIZE = 4;
const DERIVATIONS_COUNT_SIZE = 1;
const R_LENGTH = 32;
const S_LENGTH = 32;

export type SignPersonalMessageCommandArgs = {
  /**
   * The derivation path to use to sign the transaction.
   */
  readonly derivationPath: string;
  /**
   * The complete serialized transaction data.
   */
  readonly message: string;
  /**
   * The index of the chunk to sign.
   */
  readonly index: number;
};

export type SignPersonalMessageCommandResponse = Maybe<Signature>;

export class SignPersonalMessageCommand
  implements
    Command<SignPersonalMessageCommandResponse, SignPersonalMessageCommandArgs>
{
  readonly args: SignPersonalMessageCommandArgs;

  constructor(args: SignPersonalMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, message, index } = this.args;
    const signPersonalMessageArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x08,
      p1: index === 0 ? 0x00 : 0x80,
      p2: 0x00,
    };
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const builder = new ApduBuilder(signPersonalMessageArgs);
    const messageFirstChunkIndex =
      MAX_CHUNK_SIZE -
      paths.length * PATH_SIZE -
      DERIVATIONS_COUNT_SIZE -
      MESSAGE_LENGTH_SIZE;

    if (index === 0) {
      // add derivation paths count to the first packet
      builder.add8BitUIntToData(paths.length);
      // add every derivation path
      paths.forEach((path) => {
        builder.add32BitUIntToData(path);
      });
      // add message length
      builder.add32BitUIntToData(message.length);
      // add 150 bytes of data minus the count of derivation, the path size and the message length
      builder.addAsciiStringToData(message.slice(0, messageFirstChunkIndex));
    } else {
      // add 150 bytes of data starting from the second packet
      builder.addAsciiStringToData(
        message.slice(
          messageFirstChunkIndex + (index - 1) * MAX_CHUNK_SIZE,
          messageFirstChunkIndex + index * MAX_CHUNK_SIZE,
        ),
      );
    }
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignPersonalMessageCommandResponse> {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    // The data is returned only for the last chunk
    const v = parser.extract8BitUInt();
    if (!v) {
      return CommandResultFactory({ data: Nothing });
    }

    const r = parser.encodeToHexaString(
      parser.extractFieldByLength(R_LENGTH),
      true,
    );
    if (!r) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("R is missing"),
      });
    }

    const s = parser.encodeToHexaString(
      parser.extractFieldByLength(S_LENGTH),
      true,
    );
    if (!s) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("S is missing"),
      });
    }

    return CommandResultFactory({
      data: Just({
        r,
        s,
        v,
      }),
    });
  }
}
