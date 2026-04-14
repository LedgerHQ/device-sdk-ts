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
  SignTransferWithMemoCommand,
  type SignTransferWithMemoCommandResponse,
} from "@internal/app-binder/command/SignTransferWithMemoCommand";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import { P1 } from "@internal/app-binder/constants";

// Serialized transaction layout:
// [sender:32][nonce:8][energy:8][payloadSize:4][expiry:8][type:1] = 61 bytes header
// [recipient:32][memoLength:2][memo:N][amount:8]
const HEADER_LENGTH = 61;
const RECIPIENT_LENGTH = 32;
const MEMO_LENGTH_FIELD = 2;
const AMOUNT_LENGTH = 8;

type SendTransferWithMemoTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SendTransferWithMemoTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendTransferWithMemoTaskArgs,
    private readonly logger: LoggerPublisherService,
  ) {}

  async run(): Promise<
    CommandResult<SignTransferWithMemoCommandResponse, ConcordiumErrorCodes>
  > {
    this.logger.debug("[run] Starting SendTransferWithMemoTask", {
      data: {
        derivationPath: this.args.derivationPath,
        transactionLength: this.args.transaction.length,
      },
    });

    const { derivationPath, transaction } = this.args;
    const pathBytes = encodeDerivationPath(derivationPath);

    const minLength =
      HEADER_LENGTH + RECIPIENT_LENGTH + MEMO_LENGTH_FIELD + AMOUNT_LENGTH;
    if (transaction.length < minLength) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Transaction too short: expected at least ${minLength} bytes, got ${transaction.length}`,
        ),
      });
    }

    // Parse the serialized transaction to extract components
    let offset = 0;

    // Header: sender(32) + nonce(8) + energy(8) + payloadSize(4) + expiry(8) + type(1)
    const header = transaction.slice(offset, offset + HEADER_LENGTH);
    offset += HEADER_LENGTH;

    // Recipient (32 bytes)
    const recipient = transaction.slice(offset, offset + RECIPIENT_LENGTH);
    offset += RECIPIENT_LENGTH;

    // Memo length (2 bytes, big-endian)
    const memoLength =
      ((transaction[offset] ?? 0) << 8) | (transaction[offset + 1] ?? 0);
    const memoLengthBytes = transaction.slice(
      offset,
      offset + MEMO_LENGTH_FIELD,
    );
    offset += MEMO_LENGTH_FIELD;

    if (offset + memoLength + AMOUNT_LENGTH !== transaction.length) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Invalid TransferWithMemo layout: expected ${offset + memoLength + AMOUNT_LENGTH} bytes, got ${transaction.length}`,
        ),
      });
    }

    // Memo (N bytes)
    const memo = transaction.slice(offset, offset + memoLength);
    offset += memoLength;

    // Amount (8 bytes)
    const amount = transaction.slice(offset, offset + AMOUNT_LENGTH);

    // Step 1: Send header payload (path + header + recipient + memoLength)
    const headerPayload = new Uint8Array(
      pathBytes.length +
        header.length +
        recipient.length +
        memoLengthBytes.length,
    );

    if (headerPayload.length > APDU_MAX_PAYLOAD) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Header payload exceeds APDU limit: ${headerPayload.length} bytes > ${APDU_MAX_PAYLOAD}`,
        ),
      });
    }
    headerPayload.set(pathBytes, 0);
    headerPayload.set(header, pathBytes.length);
    headerPayload.set(recipient, pathBytes.length + header.length);
    headerPayload.set(
      memoLengthBytes,
      pathBytes.length + header.length + recipient.length,
    );

    const headerResult = await this.api.sendCommand(
      new SignTransferWithMemoCommand({
        p1: P1.INITIAL_WITH_MEMO,
        data: headerPayload,
      }),
    );

    if (!isSuccessCommandResult(headerResult)) {
      this.logger.debug("[run] Header step failed", {
        data: { error: headerResult.error },
      });
      return headerResult;
    }

    // Step 2: Send memo chunks
    for (
      let memoOffset = 0;
      memoOffset < memo.length;
      memoOffset += APDU_MAX_PAYLOAD
    ) {
      const chunk = memo.slice(memoOffset, memoOffset + APDU_MAX_PAYLOAD);
      const memoResult = await this.api.sendCommand(
        new SignTransferWithMemoCommand({
          p1: P1.MEMO,
          data: chunk,
        }),
      );

      if (!isSuccessCommandResult(memoResult)) {
        this.logger.debug("[run] Memo chunk failed", {
          data: { memoOffset, error: memoResult.error },
        });
        return memoResult;
      }
    }

    // Step 3: Send amount — returns signature
    const amountResult = await this.api.sendCommand(
      new SignTransferWithMemoCommand({
        p1: P1.AMOUNT,
        data: amount,
      }),
    );

    if (!isSuccessCommandResult(amountResult)) {
      this.logger.debug("[run] Amount step failed", {
        data: { error: amountResult.error },
      });
      return amountResult;
    }

    this.logger.debug("[run] All steps completed successfully", {
      data: { signature: amountResult.data },
    });

    return CommandResultFactory({
      data: amountResult.data as Signature,
    });
  }
}
