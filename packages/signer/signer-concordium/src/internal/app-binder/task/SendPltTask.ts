import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import {
  SignPltCommand,
  type SignPltCommandResponse,
} from "@internal/app-binder/command/SignPltCommand";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import { InvalidPltTransactionError } from "@internal/app-binder/command/utils/InvalidPltTransactionError";
import { P1 } from "@internal/app-binder/constants";

// Serialized TokenUpdate transaction layout:
// [header:60][kind:1 = 0x1B][tokenIdLength:1][tokenId:1..128][cborTotalLength:4 BE][cbor:N]

const HEADER_LENGTH = 60;
const KIND_LENGTH = 1;
const TOKEN_ID_LENGTH_FIELD = 1;
const CBOR_LENGTH_FIELD = 4;

const TRANSACTION_KIND_TOKEN_UPDATE = 0x1b;

/** PLT_TOKEN_ID_MAX in the app (`src/helpers/app_sizes.h`). */
const TOKEN_ID_MAX = 128;
/** APP_PLT_CBOR_MAX in the app (`src/helpers/app_sizes.h`). */
const CBOR_MAX = 512;

const MIN_TRANSACTION_LENGTH =
  HEADER_LENGTH +
  KIND_LENGTH +
  TOKEN_ID_LENGTH_FIELD +
  1 +
  CBOR_LENGTH_FIELD +
  1;

type SendPltTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

/**
 * Streams a PLT (TokenUpdate) transaction to the device over INS 0x27.
 *
 * One INIT frame (P1=0x00) carries the derivation path and everything up to and
 * including the CBOR length, then CONT frames (P1=0x01) carry the CBOR payload.
 * Chunking is byte-oriented: a CBOR field may span a frame boundary, since the
 * device buffers the whole payload before parsing it.
 *
 * `maxFee` is not part of this flow — the PLT review screens display no fee.
 */
export class SendPltTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendPltTaskArgs,
    private readonly logger: LoggerPublisherService,
  ) {}

  async run(): Promise<
    CommandResult<SignPltCommandResponse, ConcordiumErrorCodes>
  > {
    const { derivationPath, transaction } = this.args;

    this.logger.debug("[run] Starting SendPltTask", {
      data: {
        derivationPath,
        transactionLength: transaction.length,
      },
    });

    if (transaction.length < MIN_TRANSACTION_LENGTH) {
      return this.reject(
        `expected at least ${MIN_TRANSACTION_LENGTH} bytes, got ${transaction.length}`,
      );
    }

    const kind = transaction[HEADER_LENGTH]!;
    if (kind !== TRANSACTION_KIND_TOKEN_UPDATE) {
      return this.reject(
        `expected transaction kind ${TRANSACTION_KIND_TOKEN_UPDATE} (0x1b), got ${kind} (0x${kind.toString(16)})`,
      );
    }

    const tokenIdLength = transaction[HEADER_LENGTH + KIND_LENGTH]!;
    if (tokenIdLength < 1 || tokenIdLength > TOKEN_ID_MAX) {
      return this.reject(
        `token id length must be between 1 and ${TOKEN_ID_MAX}, got ${tokenIdLength}`,
      );
    }

    const cborLengthOffset =
      HEADER_LENGTH + KIND_LENGTH + TOKEN_ID_LENGTH_FIELD + tokenIdLength;
    const cborOffset = cborLengthOffset + CBOR_LENGTH_FIELD;

    if (transaction.length < cborOffset) {
      return this.reject(
        `truncated before the CBOR length field: need ${cborOffset} bytes, got ${transaction.length}`,
      );
    }

    const cborTotalLength = readUint32BE(transaction, cborLengthOffset);
    if (cborTotalLength < 1 || cborTotalLength > CBOR_MAX) {
      return this.reject(
        `CBOR length must be between 1 and ${CBOR_MAX}, got ${cborTotalLength}`,
      );
    }

    const cbor = transaction.slice(cborOffset);
    if (cbor.length !== cborTotalLength) {
      return this.reject(
        `declared CBOR length ${cborTotalLength} does not match the ${cbor.length} remaining bytes`,
      );
    }

    const pathBytes = encodeDerivationPath(derivationPath);
    const initPayload = new Uint8Array(pathBytes.length + cborOffset);
    initPayload.set(pathBytes, 0);
    initPayload.set(transaction.slice(0, cborOffset), pathBytes.length);

    if (initPayload.length > APDU_MAX_PAYLOAD) {
      return this.reject(
        `INIT frame exceeds the APDU limit: ${initPayload.length} bytes > ${APDU_MAX_PAYLOAD}`,
      );
    }

    const initResult = await this.api.sendCommand(
      new SignPltCommand({ p1: P1.PLT_INIT, data: initPayload }),
    );

    if (!isSuccessCommandResult(initResult)) {
      this.logger.debug("[run] INIT frame failed", {
        data: { error: initResult.error },
      });
      return initResult;
    }

    let signature: Signature = new Uint8Array() as Signature;

    for (let offset = 0; offset < cbor.length; offset += APDU_MAX_PAYLOAD) {
      const chunk = cbor.slice(offset, offset + APDU_MAX_PAYLOAD);
      const contResult: CommandResult<
        SignPltCommandResponse,
        ConcordiumErrorCodes
      > = await this.api.sendCommand(
        new SignPltCommand({ p1: P1.PLT_CONT, data: chunk }),
      );

      if (!isSuccessCommandResult(contResult)) {
        this.logger.debug("[run] CONT frame failed", {
          data: { offset, error: contResult.error },
        });
        return contResult;
      }

      signature = contResult.data;
    }

    this.logger.debug("[run] All frames completed successfully", {
      data: { signature },
    });

    return CommandResultFactory({ data: signature });
  }

  private reject(
    message: string,
  ): CommandResult<SignPltCommandResponse, ConcordiumErrorCodes> {
    this.logger.debug("[run] Local validation rejected the transaction", {
      data: { message },
    });
    return CommandResultFactory({
      error: new InvalidPltTransactionError(message),
    });
  }
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}
