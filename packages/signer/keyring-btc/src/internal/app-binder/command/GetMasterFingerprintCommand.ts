// https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/bitcoin.md#get_master_fingerprint
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
} from "@ledgerhq/device-management-kit";

const MASTER_FINGERPRINT_LENGTH = 4;

type GetMasterFingerprintCommandResponse = {
  masterFingerprint: string;
};

export class GetMasterFingerprintCommand
  implements Command<GetMasterFingerprintCommandResponse, void>
{
  getApdu(): Apdu {
    const getMasterFingerprintArgs: ApduBuilderArgs = {
      cla: 0xe1,
      ins: 0x05,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(getMasterFingerprintArgs).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetMasterFingerprintCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    if (!parser.testMinimalLength(MASTER_FINGERPRINT_LENGTH)) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Master fingerprint is missing"),
      });
    }

    const masterFingerprint = parser.encodeToHexaString(
      parser.extractFieldByLength(MASTER_FINGERPRINT_LENGTH),
    );

    return CommandResultFactory({
      data: {
        masterFingerprint,
      },
    });
  }
}
