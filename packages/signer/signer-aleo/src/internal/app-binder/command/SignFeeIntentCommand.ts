import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

export type SignFeeIntentCommandArgs = {
  readonly feeIntent: Uint8Array;
};

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

  private readonly args: SignFeeIntentCommandArgs;

  constructor(args: SignFeeIntentCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const signFeeIntentArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x06,
      p1: 0x02, // Second chunk / fee intent
      p2: 0x00,
    };

    const builder = new ApduBuilder(signFeeIntentArgs);

    builder.add16BitUIntToData(this.args.feeIntent.byteLength);

    // Add the fee intent data (no derivation path for the second chunk)
    builder.addBufferToData(this.args.feeIntent);

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

      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to extract data from response",
        ),
      });
    });
  }
}
