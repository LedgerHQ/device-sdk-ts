import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import {
  CONCORDIUM_APP_ERRORS,
  ConcordiumAppCommandErrorFactory,
  type ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";
import { encodeDisplayFee } from "@internal/app-binder/utils/FeeDisplay";

export type SignTransferCommandArgs = {
  readonly chunkedData: Uint8Array;
  readonly isLastChunk: boolean;
  /**
   * When set AND `isLastChunk` is true, the APDU is built with P2=FEE_DISPLAY
   * and 8 big-endian fee bytes are appended to the chunked data so the device
   * can show the fee to the user. The caller is responsible for only setting
   * this on firmwares that accept the extension (≥ 5.5.2).
   */
  readonly displayFeeMicroCcd?: bigint;
};

export type SignTransferCommandResponse = Signature;

export class SignTransferCommand
  implements
    Command<
      SignTransferCommandResponse,
      SignTransferCommandArgs,
      ConcordiumErrorCodes
    >
{
  readonly name = "SignTransfer";

  private readonly args: SignTransferCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransferCommandResponse,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  constructor(args: SignTransferCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const useFeeDisplay =
      this.args.isLastChunk && this.args.displayFeeMicroCcd !== undefined;

    const apduBuilder = new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SIGN_TRANSFER,
      p1: 0x00,
      p2: useFeeDisplay
        ? P2.FEE_DISPLAY
        : this.args.isLastChunk
          ? P2.LAST
          : P2.MORE,
    });

    apduBuilder.addBufferToData(this.args.chunkedData);

    if (useFeeDisplay) {
      // Fee bytes are appended to the APDU for on-device display only —
      // they are NOT part of the transaction payload the device hashes.
      apduBuilder.addBufferToData(
        encodeDisplayFee(this.args.displayFeeMicroCcd!),
      );
    }

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransferCommandResponse, ConcordiumErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const remaining = apduParser.getUnparsedRemainingLength();
      const signature = apduParser.extractFieldByLength(remaining);

      return CommandResultFactory({
        data: signature as Signature,
      });
    });
  }
}
