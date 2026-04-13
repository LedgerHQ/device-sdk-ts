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

export type SignFeeIntentCommandArgs = AleoChunkableCommandArgs;

export type SignFeeIntentCommandResponse = {
  readonly tlvSignature: string;
};

/**
 * Command to sign the fee intent (second part) of an Aleo public transfer transaction.
 * This command sends the fee intent data to the device.
 * The device will prompt the user for confirmation and return the signature.
 * This command must be called after SignRootIntentCommand.
 */
export class SignFeeIntentCommand
  implements
    Command<
      SignFeeIntentCommandResponse,
      SignFeeIntentCommandArgs,
      AleoErrorCodes
    >
{
  readonly name = "signFeeIntent";
  private readonly errorHelper = new CommandErrorHelper<
    SignFeeIntentCommandResponse,
    AleoErrorCodes
  >(ALEO_APP_ERRORS, AleoAppCommandErrorFactory);

  constructor(private readonly args: SignFeeIntentCommandArgs) {}

  getApdu(): Apdu {
    const signFeeIntentArgs: ApduBuilderArgs = {
      cla: ALEO_CLA,
      ins: INS.SIGN_INTENT,
      p1: P1.SIGN_MODE_FEE,
      p2: this.args.isFirst ? P2.FIRST_CHUNK : P2.NEXT_CHUNK,
    };

    const builder = new ApduBuilder(signFeeIntentArgs);

    // Add the chunked data
    builder.addBufferToData(this.args.chunkedData);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignFeeIntentCommandResponse, AleoErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      // Get the remaining length of the response (data before the status code)
      const remainingLength = parser.getUnparsedRemainingLength();

      // Extract the data field
      const data = parser.extractFieldByLength(remainingLength);

      if (data && data.length > 0) {
        // Encode the data to a hexadecimal string
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
