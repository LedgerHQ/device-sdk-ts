import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { type SignCredentialDeploymentCommand } from "@internal/app-binder/command/SignCredentialDeploymentCommand";
import {
  ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { P1, P2 } from "@internal/app-binder/constants";
import { SendCredentialDeploymentTransactionTask } from "@internal/app-binder/task/SendCredentialDeploymentTransactionTask";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";

function getP1(cmd: SignCredentialDeploymentCommand): number {
  return cmd.getApdu().getRawApdu()[2]!;
}

function getP2(cmd: SignCredentialDeploymentCommand): number {
  return cmd.getApdu().getRawApdu()[3]!;
}

/**
 * Build a minimal serialized credential deployment byte buffer.
 *
 * Wire format:
 * [numKeys:1][keys:34*N]
 * [threshold:1][credId:48][ipIdentity:4][revocationThreshold:1][arDataCount:2]
 * [arData:100*M]
 * [validTo:3][createdAt:3][attrCount:2]
 * [tag:1 + valueLen:1 + value:valueLen]*attrCount
 * [proofLength:4][proofs:proofLength]
 * [newAccountIndicator:1][expiry:8]
 */
function buildCredentialDeploymentBytes(opts?: {
  numKeys?: number;
  numArData?: number;
  numAttributes?: number;
  attrValueSize?: number;
  proofSize?: number;
}): Uint8Array {
  const numKeys = opts?.numKeys ?? 1;
  const numArData = opts?.numArData ?? 1;
  const numAttrs = opts?.numAttributes ?? 1;
  const attrValueSize = opts?.attrValueSize ?? 5;
  const proofSize = opts?.proofSize ?? 100;

  const parts: Uint8Array[] = [];

  // Verification keys: [numKeys:1][key:34]*N
  parts.push(new Uint8Array([numKeys]));
  for (let i = 0; i < numKeys; i++) {
    parts.push(new Uint8Array(34).fill(0xa0 + i));
  }

  // Threshold(1) + CredId(48) + IpIdentity(4) + RevocationThreshold(1) + ArDataCount(2)
  const thresholdBlock = new Uint8Array(56);
  thresholdBlock[0] = 0x01; // threshold
  thresholdBlock.fill(0x22, 1, 49); // credId
  thresholdBlock.fill(0x33, 49, 53); // ipIdentity
  thresholdBlock[53] = 0x01; // revocationThreshold
  thresholdBlock[54] = (numArData >> 8) & 0xff; // arDataCount BE
  thresholdBlock[55] = numArData & 0xff;
  parts.push(thresholdBlock);

  // AR data entries
  for (let i = 0; i < numArData; i++) {
    parts.push(new Uint8Array(100).fill(0xb0 + i));
  }

  // Dates(3+3) + AttrCount(2)
  const datesBlock = new Uint8Array(8);
  datesBlock.fill(0x44, 0, 6); // validTo + createdAt
  datesBlock[6] = (numAttrs >> 8) & 0xff; // attrCount BE
  datesBlock[7] = numAttrs & 0xff;
  parts.push(datesBlock);

  // Attributes: [tag:1][valueLen:1][value:N]
  for (let i = 0; i < numAttrs; i++) {
    parts.push(
      new Uint8Array([i + 1]),
      new Uint8Array([attrValueSize]),
      new Uint8Array(attrValueSize).fill(0xcc),
    );
  }

  // Proof length (4 bytes BE) + proofs
  const proofLenBuf = new Uint8Array(4);
  new DataView(proofLenBuf.buffer).setUint32(0, proofSize, false);
  parts.push(proofLenBuf);
  parts.push(new Uint8Array(proofSize).fill(0xdd));

  // New account indicator (0x00) + expiry (8 bytes)
  const finalBlock = new Uint8Array(9);
  finalBlock[0] = 0x00;
  finalBlock.fill(0xee, 1, 9);
  parts.push(finalBlock);

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

describe("SendCredentialDeploymentTransactionTask", () => {
  let sentCommands: SignCredentialDeploymentCommand[];
  let sendCommandMock: ReturnType<typeof vi.fn>;
  let apiMock: InternalApi;
  let loggerMock: LoggerPublisherService;

  beforeEach(() => {
    sentCommands = [];
    sendCommandMock = vi.fn();
    apiMock = {
      sendCommand: sendCommandMock,
    } as unknown as InternalApi;
    loggerMock = {
      debug: vi.fn(),
    } as unknown as LoggerPublisherService;
  });

  function succeedAllWithFinalSignature(signature: Uint8Array) {
    sendCommandMock.mockImplementation(
      (cmd: SignCredentialDeploymentCommand) => {
        sentCommands.push(cmd);
        const p2 = getP2(cmd);
        if (p2 === P2.LAST) {
          return Promise.resolve(CommandResultFactory({ data: signature }));
        }
        return Promise.resolve(
          CommandResultFactory({ data: new Uint8Array(0) }),
        );
      },
    );
  }

  function failAtStep(stepIndex: number) {
    let callIndex = 0;
    sendCommandMock.mockImplementation(
      (cmd: SignCredentialDeploymentCommand) => {
        sentCommands.push(cmd);
        if (callIndex++ === stepIndex) {
          return Promise.resolve(
            CommandResultFactory({
              error: new ConcordiumAppCommandError({
                message: "User rejected",
                errorCode: ConcordiumErrorCodes.USER_REJECTED,
              }),
            }),
          );
        }
        return Promise.resolve(
          CommandResultFactory({ data: new Uint8Array(0) }),
        );
      },
    );
  }

  it("should send the full 7-step sequence and return signature", async () => {
    const signature = new Uint8Array(64).fill(0xab);
    const transaction = buildCredentialDeploymentBytes();
    succeedAllWithFinalSignature(signature);

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(signature);
    }

    // Verify P1 step ordering
    const p1Sequence = sentCommands.map(getP1);
    expect(p1Sequence).toStrictEqual([
      P1.FIRST_CHUNK,
      P1.VERIFICATION_KEY_COUNT,
      P1.VERIFICATION_KEY,
      P1.SIGNATURE_THRESHOLD,
      P1.AR_IDENTITY,
      P1.CREDENTIAL_DATES,
      P1.ATTRIBUTE_TAG,
      P1.ATTRIBUTE_VALUE, // value length
      P1.ATTRIBUTE_VALUE, // value data
      P1.LENGTH_OF_PROOFS,
      P1.PROOFS,
      P1.NEW_OR_EXISTING,
    ]);

    // Only the final step uses P2=LAST
    const p2Sequence = sentCommands.map(getP2);
    for (let i = 0; i < p2Sequence.length - 1; i++) {
      expect(p2Sequence[i]).toBe(P2.MORE);
    }
    expect(p2Sequence.at(-1)).toBe(P2.LAST);
  });

  it("should handle multiple verification keys", async () => {
    const transaction = buildCredentialDeploymentBytes({ numKeys: 3 });
    succeedAllWithFinalSignature(new Uint8Array(64));

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    await task.run();

    const verKeyCommands = sentCommands.filter(
      (cmd) => getP1(cmd) === P1.VERIFICATION_KEY,
    );
    expect(verKeyCommands).toHaveLength(3);
  });

  it("should handle multiple AR identity entries", async () => {
    const transaction = buildCredentialDeploymentBytes({ numArData: 2 });
    succeedAllWithFinalSignature(new Uint8Array(64));

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    await task.run();

    const arCommands = sentCommands.filter(
      (cmd) => getP1(cmd) === P1.AR_IDENTITY,
    );
    expect(arCommands).toHaveLength(2);
  });

  it("should handle multiple attributes", async () => {
    const transaction = buildCredentialDeploymentBytes({ numAttributes: 3 });
    succeedAllWithFinalSignature(new Uint8Array(64));

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    await task.run();

    const tagCommands = sentCommands.filter(
      (cmd) => getP1(cmd) === P1.ATTRIBUTE_TAG,
    );
    expect(tagCommands).toHaveLength(3);
  });

  it("should chunk large proofs into multiple APDUs", async () => {
    const transaction = buildCredentialDeploymentBytes({ proofSize: 600 });
    succeedAllWithFinalSignature(new Uint8Array(64));

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    await task.run();

    const proofCommands = sentCommands.filter(
      (cmd) => getP1(cmd) === P1.PROOFS,
    );
    expect(proofCommands.length).toBeGreaterThan(1);
  });

  it("should return error when derivation path step fails", async () => {
    const transaction = buildCredentialDeploymentBytes();
    failAtStep(0);

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(1);
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ConcordiumAppCommandError);
    }
  });

  it("should return error when a mid-sequence step fails", async () => {
    const transaction = buildCredentialDeploymentBytes();
    failAtStep(3); // SIGNATURE_THRESHOLD

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(4);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("should return error when final step is rejected", async () => {
    const transaction = buildCredentialDeploymentBytes();
    // Minimal: 12 steps total, final is step 11
    failAtStep(11);

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ConcordiumAppCommandError);
    }
  });

  it("should return error for trailing bytes", async () => {
    const valid = buildCredentialDeploymentBytes();
    const withTrailing = new Uint8Array(valid.length + 10);
    withTrailing.set(valid);
    withTrailing.fill(0xff, valid.length);
    succeedAllWithFinalSignature(new Uint8Array(64));

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction: withTrailing },
      loggerMock,
    );

    const result = await task.run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    }
  });

  it("should return error for truncated transaction", async () => {
    const transaction = new Uint8Array(5); // way too short
    succeedAllWithFinalSignature(new Uint8Array(64));

    const task = new SendCredentialDeploymentTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    // Should fail after path step when trying to read key count
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    }
  });
});
