import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ALEO_CLA,
  INS,
  P1,
  P2,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import { type AleoChunkableCommandArgs } from "@internal/app-binder/task/AleoChunkableCommandArgs";

import {
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

export type SignNestedCallCommandArgs = AleoChunkableCommandArgs;

export type SignNestedCallCommandResponse = {
  readonly tlvSignature: string;
};

/**
 * Command to sign a nested call in an Aleo transaction.
 * This command can be called multiple times after the root intent is signed.
 * The device uses tvk from the intent's signature response as 'root_tvk'.
 * On success, the device responds with TLV-encoded request signature data and a 0x9000 status code.
 */
export class SignNestedCallCommand
  implements
    Command<
      SignNestedCallCommandResponse,
      SignNestedCallCommandArgs,
      AleoErrorCodes
    >
{
  readonly name = "signNestedCall";
  private readonly errorHelper = new CommandErrorHelper<
    SignNestedCallCommandResponse,
    AleoErrorCodes
  >(ALEO_APP_ERRORS, AleoAppCommandErrorFactory);

  constructor(private readonly args: SignNestedCallCommandArgs) {}

  getApdu(): Apdu {
    const signNestedCallArgs: ApduBuilderArgs = {
      cla: ALEO_CLA,
      ins: INS.SIGN_INTENT,
      p1: P1.SIGN_MODE_NESTED_CALL,
      p2: this.args.isFirst ? P2.FIRST_CHUNK : P2.NEXT_CHUNK,
    };

    const builder = new ApduBuilder(signNestedCallArgs);

    builder.addBufferToData(this.args.chunkedData);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignNestedCallCommandResponse, AleoErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const remainingLength = parser.getUnparsedRemainingLength();

      const data = parser.extractFieldByLength(remainingLength);

      if (data && data.length > 0) {
        return CommandResultFactory({
          data: {
            tlvSignature: parser.encodeToHexaString(data),
          },
        });
      }

      // for intermediate chunks, the device returns 0 bytes of data with 0x9000.
      return CommandResultFactory({
        data: {
          tlvSignature: "",
        },
      });
    });
  }
}
