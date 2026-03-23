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
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import { type AleoChunkableCommandArgs } from "@internal/app-binder/task/AleoChunkableCommandArgs";

import {
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

export type SignRootIntentCommandArgs = AleoChunkableCommandArgs;

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

  constructor(private readonly args: SignRootIntentCommandArgs) {}

  getApdu(): Apdu {
    const signRootIntentArgs: ApduBuilderArgs = {
      cla: ALEO_CLA,
      ins: INS.SIGN_INTENT,
      p1: P1.SIGN_MODE_ROOT,
      p2: this.args.isFirst ? 0x00 : 0x01,
    };

    const builder = new ApduBuilder(signRootIntentArgs);

    // Add the chunked data
    builder.addBufferToData(this.args.chunkedData);

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

      console.log("Response data: ", data);

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
