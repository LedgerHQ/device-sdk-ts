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
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

export type SignRootIntentCommandArgs = {
  readonly derivationPath: string;
  readonly rootIntent: Uint8Array;
};

export type SignRootIntentCommandResponse = {
  readonly tlvSignature: string;
};

/**
 * Command to sign the root intent (first part) of an Aleo public transfer transaction.
 * This command sends the derivation path and root intent data to the device.
 * On success, the device responds with TLV-encoded signature data and a 0x9000 status code.
 * After this, SignFeeIntentCommand should be called to complete the transaction.
 */
export class SignRootIntentCommand
  implements
    Command<
      SignRootIntentCommandResponse,
      SignRootIntentCommandArgs,
      AleoErrorCodes
    >
{
  readonly name = "signRootIntent";
  private readonly errorHelper = new CommandErrorHelper<
    SignRootIntentCommandResponse,
    AleoErrorCodes
  >(ALEO_APP_ERRORS, AleoAppCommandErrorFactory);

  private readonly args: SignRootIntentCommandArgs;

  constructor(args: SignRootIntentCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const signRootIntentArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x06,
      p1: 0x00, // First chunk
      p2: 0x00,
    };

    const builder = new ApduBuilder(signRootIntentArgs);

    // Add the derivation path
    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    // Add intent length
    builder.add16BitUIntToData(this.args.rootIntent.byteLength);

    // Add the root intent data
    builder.addBufferToData(this.args.rootIntent);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignRootIntentCommandResponse, AleoErrorCodes> {
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
