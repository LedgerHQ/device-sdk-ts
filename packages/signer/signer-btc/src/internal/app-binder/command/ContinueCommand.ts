import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { CommandUtils as BtcCommandUtils } from "@internal/utils/CommandUtils";

import {
  BitcoinAppCommandError,
  bitcoinAppErrors,
} from "./utils/bitcoinAppErrors";

export type ContinueCommandArgs = {
  payload: Uint8Array;
};

const R_LENGTH = 32;
const S_LENGTH = 32;

export class ContinueCommand
  implements Command<ApduResponse | Signature, ContinueCommandArgs>
{
  constructor(private readonly args: ContinueCommandArgs) {}
  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xf8,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    })
      .addBufferToData(this.args.payload)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ApduResponse | Signature> {
    if (BtcCommandUtils.isContinueResponse(response)) {
      return CommandResultFactory({
        data: response,
      });
    }
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    // !!! POC to test with the real device
    // !!! final implementation will have this part injected
    const parser = new ApduParser(response);
    const errorCode = parser.encodeToHexaString(response.statusCode);
    if (isCommandErrorCode(errorCode, bitcoinAppErrors)) {
      return CommandResultFactory({
        error: new BitcoinAppCommandError({
          ...bitcoinAppErrors[errorCode],
          errorCode,
        }),
      });
    }

    // Extract 'v'
    const v = parser.extract8BitUInt();
    if (v === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("V is missing"),
      });
    }

    // Extract 'r'
    const r = parser.encodeToHexaString(
      parser.extractFieldByLength(R_LENGTH),
      true,
    );
    if (!r) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("R is missing"),
      });
    }

    // Extract 's'
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
      data: {
        v,
        r,
        s,
      },
    });
    // !!! POC to test with the real device
    // !!! final implementation will have this part injected
  }
}
