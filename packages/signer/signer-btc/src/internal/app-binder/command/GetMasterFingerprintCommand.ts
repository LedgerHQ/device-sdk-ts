// https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/bitcoin.md#get_master_fingerprint
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
  BTC_APP_ERRORS,
  BtcAppCommandErrorFactory,
  type BtcErrorCodes,
} from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";

const MASTER_FINGERPRINT_LENGTH = 4;

type GetMasterFingerprintCommandResponse = {
  masterFingerprint: Uint8Array;
};

export class GetMasterFingerprintCommand
  implements Command<GetMasterFingerprintCommandResponse, void, BtcErrorCodes>
{
  readonly name = "getMasterFingerprint";
  constructor(
    private readonly _errorHelper = new CommandErrorHelper<
      GetMasterFingerprintCommandResponse,
      BtcErrorCodes
    >(
      BTC_APP_ERRORS,
      BtcAppCommandErrorFactory,
      BtcCommandUtils.isSuccessResponse,
    ),
  ) {}
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
  ): CommandResult<GetMasterFingerprintCommandResponse, BtcErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() => {
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
