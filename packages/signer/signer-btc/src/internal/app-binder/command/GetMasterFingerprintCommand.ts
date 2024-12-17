// https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/bitcoin.md#get_master_fingerprint
import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { BtcCommand } from "@internal/app-binder/command/utils/BtcCommand";

const MASTER_FINGERPRINT_LENGTH = 4;

type GetMasterFingerprintCommandResponse = {
  masterFingerprint: Uint8Array;
};

export class GetMasterFingerprintCommand extends BtcCommand<GetMasterFingerprintCommandResponse> {
  override getApdu(): Apdu {
    const getMasterFingerprintArgs: ApduBuilderArgs = {
      cla: 0xe1,
      ins: 0x05,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(getMasterFingerprintArgs).build();
  }

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<GetMasterFingerprintCommandResponse, BitcoinAppErrorCodes> {
    return this._getError(response).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const masterFingerprint = parser.extractFieldByLength(
        MASTER_FINGERPRINT_LENGTH,
      );
      if (!masterFingerprint) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Master fingerprint is missing"),
        });
      }

      return CommandResultFactory({
        data: {
          masterFingerprint,
        },
      });
    });
  }
}
