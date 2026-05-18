import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import {
  SignTransferCommand,
  type SignTransferCommandResponse,
} from "@internal/app-binder/command/SignTransferCommand";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import { encodeMaxFeeBigEndian } from "@internal/app-binder/command/utils/EncodeMaxFee";
import { P2 } from "@internal/app-binder/constants";

// Serialized transaction layout:
// [sender:32][nonce:8][energy:8][payloadSize:4][expiry:8][type:1] = 61 bytes header
// [recipient:32][amount:8]

type SendTransferTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
  maxFee: bigint;
  supportsFeeDisplay: boolean;
};

export class SendTransferTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendTransferTaskArgs,
    private readonly logger: LoggerPublisherService,
  ) {}

  async run(): Promise<
    CommandResult<SignTransferCommandResponse, ConcordiumErrorCodes>
  > {
    this.logger.debug("[run] Starting SendTransferTask", {
      data: {
        derivationPath: this.args.derivationPath,
        transactionLength: this.args.transaction.length,
        supportsFeeDisplay: this.args.supportsFeeDisplay,
      },
    });

    const { derivationPath, transaction, maxFee, supportsFeeDisplay } =
      this.args;
    const pathBytes = encodeDerivationPath(derivationPath);

    const feeSuffix = supportsFeeDisplay
      ? encodeMaxFeeBigEndian(maxFee)
      : new Uint8Array(0);

    const payload = new Uint8Array(
      pathBytes.length + transaction.length + feeSuffix.length,
    );
    payload.set(pathBytes, 0);
    payload.set(transaction, pathBytes.length);
    payload.set(feeSuffix, pathBytes.length + transaction.length);

    // The firmware handler for SIGN_TRANSFER is single-shot: the full payload
    // (path + canonical bytes + optional fee suffix) must fit in one APDU.
    if (payload.length > APDU_MAX_PAYLOAD) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Transfer payload exceeds APDU limit: ${payload.length} > ${APDU_MAX_PAYLOAD}`,
        ),
      });
    }

    const result = await this.api.sendCommand(
      new SignTransferCommand({
        data: payload,
        p2: supportsFeeDisplay ? P2.FEE_DISPLAY : P2.LAST,
      }),
    );

    if (!isSuccessCommandResult(result)) {
      this.logger.debug("[run] Send failed", {
        data: { error: result.error },
      });
      return result;
    }

    this.logger.debug("[run] Signed successfully", {
      data: { signature: result.data },
    });
    return CommandResultFactory({
      data: result.data as Signature,
    });
  }
}
