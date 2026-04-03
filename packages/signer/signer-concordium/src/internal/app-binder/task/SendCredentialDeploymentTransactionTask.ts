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
  SignCredentialDeploymentCommand,
  type SignCredentialDeploymentCommandResponse,
} from "@internal/app-binder/command/SignCredentialDeploymentCommand";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import { P1, P2 } from "@internal/app-binder/constants";

const KEY_ENTRY_LENGTH = 34; // keyIndex:1 + keyType:1 + key:32
const THRESHOLD_BLOCK_LENGTH =
  1 + // threshold
  48 + // credentialId
  4 + // ipIdentity
  1 + // revocationThreshold
  2; // arDataCount
const AR_DATA_ENTRY_LENGTH = 100; // arIdentity:4 + encIdCredPubShare:96
const DATES_BLOCK_LENGTH =
  3 + // validTo
  3 + // createdAt
  2; // attributesCount
const TAG_LENGTH = 1;
const FINAL_BLOCK_LENGTH = 1 + 8; // newAccountIndicator + expiry

type TaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

type StepResult =
  | true
  | CommandResult<
      SignCredentialDeploymentCommandResponse,
      ConcordiumErrorCodes
    >;

export class SendCredentialDeploymentTransactionTask {
  private offset = 0;

  constructor(
    private readonly api: InternalApi,
    private readonly args: TaskArgs,
    private readonly logger: LoggerPublisherService,
  ) {}

  async run(): Promise<
    CommandResult<SignCredentialDeploymentCommandResponse, ConcordiumErrorCodes>
  > {
    this.logger.debug(
      "[run] Starting SendCredentialDeploymentTransactionTask",
      {
        data: {
          derivationPath: this.args.derivationPath,
          transactionLength: this.args.transaction.length,
        },
      },
    );

    const pathBytes = encodeDerivationPath(this.args.derivationPath);

    const pathResult = await this.sendStep(P1.FIRST_CHUNK, P2.MORE, pathBytes);
    if (pathResult !== true) return pathResult;

    const keysResult = await this.sendVerificationKeys();
    if (keysResult !== true) return keysResult;

    const thresholdResult = await this.sendThresholdAndArData();
    if (thresholdResult !== true) return thresholdResult;

    const attributesResult = await this.sendDatesAndAttributes();
    if (attributesResult !== true) return attributesResult;

    const proofsResult = await this.sendProofs();
    if (proofsResult !== true) return proofsResult;

    return this.sendFinalStep();
  }

  private async sendStep(
    p1: number,
    p2: number,
    data: Uint8Array,
  ): Promise<StepResult> {
    const result = await this.api.sendCommand(
      new SignCredentialDeploymentCommand({ p1, p2, data }),
    );
    if (!isSuccessCommandResult(result)) {
      this.logger.debug("[sendStep] APDU failed", {
        data: { p1, p2, offset: this.offset, error: result.error },
      });
      return result;
    }
    return true;
  }

  private async sendVerificationKeys(): Promise<StepResult> {
    const numKeys = this.readU8();
    if (numKeys === undefined) return fail("Missing verification key count");

    const step = await this.sendStep(
      P1.VERIFICATION_KEY_COUNT,
      P2.MORE,
      new Uint8Array([numKeys]),
    );
    if (step !== true) return step;

    for (let i = 0; i < numKeys; i++) {
      const key = this.read(KEY_ENTRY_LENGTH);
      if (!key) return fail(`Missing verification key at index ${i}`);
      const r = await this.sendStep(P1.VERIFICATION_KEY, P2.MORE, key);
      if (r !== true) return r;
    }
    return true;
  }

  private async sendThresholdAndArData(): Promise<StepResult> {
    const thresholdBlock = this.read(THRESHOLD_BLOCK_LENGTH);
    if (!thresholdBlock)
      return fail("Missing threshold/credId/ipIdentity block");

    const arDataCount = readU16BEFromEnd(thresholdBlock);

    const step = await this.sendStep(
      P1.SIGNATURE_THRESHOLD,
      P2.MORE,
      thresholdBlock,
    );
    if (step !== true) return step;

    for (let i = 0; i < arDataCount; i++) {
      const arData = this.read(AR_DATA_ENTRY_LENGTH);
      if (!arData) return fail(`Missing AR data entry at index ${i}`);
      const r = await this.sendStep(P1.AR_IDENTITY, P2.MORE, arData);
      if (r !== true) return r;
    }
    return true;
  }

  private async sendDatesAndAttributes(): Promise<StepResult> {
    const datesBlock = this.read(DATES_BLOCK_LENGTH);
    if (!datesBlock) return fail("Missing dates/attributes count block");

    const attrCount = readU16BEFromEnd(datesBlock);

    const step = await this.sendStep(P1.CREDENTIAL_DATES, P2.MORE, datesBlock);
    if (step !== true) return step;

    for (let i = 0; i < attrCount; i++) {
      const r = await this.sendAttribute(i);
      if (r !== true) return r;
    }
    return true;
  }

  private async sendAttribute(index: number): Promise<StepResult> {
    const tag = this.read(TAG_LENGTH);
    if (!tag) return fail(`Missing attribute tag at index ${index}`);
    const tagResult = await this.sendStep(P1.ATTRIBUTE_TAG, P2.MORE, tag);
    if (tagResult !== true) return tagResult;

    const valueLen = this.readU8();
    if (valueLen === undefined)
      return fail(`Missing attribute value length at index ${index}`);
    const vlResult = await this.sendStep(
      P1.ATTRIBUTE_VALUE,
      P2.MORE,
      new Uint8Array([valueLen]),
    );
    if (vlResult !== true) return vlResult;

    const value = this.read(valueLen);
    if (!value) return fail(`Missing attribute value at index ${index}`);
    for (const chunk of chunkPayload(value)) {
      const r = await this.sendStep(P1.ATTRIBUTE_VALUE, P2.MORE, chunk);
      if (r !== true) return r;
    }
    return true;
  }

  private async sendProofs(): Promise<StepResult> {
    const proofLenValue = this.readU32BE();
    if (proofLenValue === undefined) return fail("Missing proof length");
    const proofLenBuf = new Uint8Array(4);
    new DataView(proofLenBuf.buffer).setUint32(0, proofLenValue, false);

    const step = await this.sendStep(P1.LENGTH_OF_PROOFS, P2.MORE, proofLenBuf);
    if (step !== true) return step;

    const proofs = this.read(proofLenValue);
    if (!proofs) return fail("Missing proof data");

    for (const chunk of chunkPayload(proofs)) {
      const r = await this.sendStep(P1.PROOFS, P2.MORE, chunk);
      if (r !== true) return r;
    }
    return true;
  }

  private async sendFinalStep(): Promise<
    CommandResult<SignCredentialDeploymentCommandResponse, ConcordiumErrorCodes>
  > {
    const payload = this.read(FINAL_BLOCK_LENGTH);
    if (!payload) return fail("Missing new/existing + expiry");

    if (this.offset !== this.args.transaction.length) {
      return fail(
        `Unexpected trailing bytes: parsed ${this.offset} of ${this.args.transaction.length}`,
      );
    }

    const finalResult = await this.api.sendCommand(
      new SignCredentialDeploymentCommand({
        p1: P1.NEW_OR_EXISTING,
        p2: P2.LAST,
        data: payload,
      }),
    );

    if (!isSuccessCommandResult(finalResult)) {
      this.logger.debug("[run] Final step failed", {
        data: { error: finalResult.error },
      });
      return finalResult;
    }

    this.logger.debug("[run] Credential deployment signed successfully");
    return CommandResultFactory({ data: finalResult.data as Signature });
  }

  private read(length: number): Uint8Array | undefined {
    if (this.offset + length > this.args.transaction.length) return undefined;
    const slice = this.args.transaction.slice(
      this.offset,
      this.offset + length,
    );
    this.offset += length;
    return slice;
  }

  private readU8(): number | undefined {
    if (this.offset >= this.args.transaction.length) return undefined;
    const val = this.args.transaction[this.offset];
    this.offset += 1;
    return val;
  }

  private readU32BE(): number | undefined {
    const tx = this.args.transaction;
    if (this.offset + 4 > tx.length) return undefined;
    const val =
      ((tx[this.offset] ?? 0) << 24) |
      ((tx[this.offset + 1] ?? 0) << 16) |
      ((tx[this.offset + 2] ?? 0) << 8) |
      (tx[this.offset + 3] ?? 0);
    this.offset += 4;
    return val >>> 0;
  }
}

function readU16BEFromEnd(buf: Uint8Array): number {
  return ((buf.at(-2) ?? 0) << 8) | (buf.at(-1) ?? 0);
}

function fail(
  msg: string,
): CommandResult<
  SignCredentialDeploymentCommandResponse,
  ConcordiumErrorCodes
> {
  return CommandResultFactory({ error: new InvalidStatusWordError(msg) });
}

function chunkPayload(data: Uint8Array): Uint8Array[] {
  return Array.from(
    { length: Math.ceil(data.length / APDU_MAX_PAYLOAD) },
    (_, i) => data.slice(i * APDU_MAX_PAYLOAD, (i + 1) * APDU_MAX_PAYLOAD),
  );
}
