import {
  BlindSignReason,
  type ContextModule,
  SigningMethod,
  type SolSignReportParams,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { describe, expect, it, vi } from "vitest";

import { SolanaSigningReportTask } from "./SolanaSigningReportTask";

// Real-transaction helpers — used to exercise the extractProgramIds branches.
const DUMMY_BLOCKHASH = new PublicKey(new Uint8Array(32).fill(0xaa)).toBase58();
const COMPUTE_BUDGET_PROGRAM = new PublicKey(
  "ComputeBudget111111111111111111111111111111",
);
const KNOWN_PROGRAM = new PublicKey(
  "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
);
const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");

function makeIx(programId: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      {
        pubkey: Keypair.generate().publicKey,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId,
    data: Buffer.from([0x01]),
  });
}

function makeTx(...programs: PublicKey[]): Uint8Array {
  const payer = Keypair.generate();
  const tx = new Transaction();
  tx.recentBlockhash = DUMMY_BLOCKHASH;
  tx.feePayer = payer.publicKey;
  tx.add(...programs.map(makeIx));
  tx.sign(payer);
  return tx.serialize();
}

const loggerFactory = (): LoggerPublisherService =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as LoggerPublisherService;

function makeContextModule(signReport?: ContextModule["signReport"]) {
  return { signReport } as unknown as ContextModule;
}

// Unparseable bytes — TransactionParser returns Left, so programIds will be []
// and targetAddress will be null. Sufficient for testing the report shape.
const baseArgs = {
  messageBytes: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
  unrecognizedProgramIds: [] as string[],
  signerAppVersion: "1.4.0",
  deviceModelId: DeviceModelId.STAX,
  deviceVersion: "2.1.0",
  loggerFactory,
};

describe("SolanaSigningReportTask", () => {
  it("reports clear-sign event with no blind-sign reason", async () => {
    const signReport = vi.fn().mockResolvedValue(undefined);
    const contextModule = makeContextModule(signReport);

    await new SolanaSigningReportTask({
      ...baseArgs,
      isBlindSign: false,
      contextModule,
    }).run();

    expect(signReport).toHaveBeenCalledOnce();
    const [params] = signReport.mock.calls[0]! as [SolSignReportParams];
    expect(params).toMatchObject({
      chain: "SOL",
      signingMethod: SigningMethod.SOL_SIGN_TRANSACTION,
      isBlindSign: false,
      blindSignReason: null,
    });
  });

  it("reports blind-sign with UNRECOGNIZED_PROGRAM when unrecognized programs exist", async () => {
    const signReport = vi.fn().mockResolvedValue(undefined);
    const contextModule = makeContextModule(signReport);
    const unrecognizedProgramIds = [
      "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    ];

    await new SolanaSigningReportTask({
      ...baseArgs,
      isBlindSign: true,
      unrecognizedProgramIds,
      contextModule,
    }).run();

    expect(signReport).toHaveBeenCalledOnce();
    const [params] = signReport.mock.calls[0]! as [SolSignReportParams];
    expect(params).toMatchObject({
      isBlindSign: true,
      blindSignReason: BlindSignReason.UNRECOGNIZED_PROGRAM,
      unrecognizedPrograms: unrecognizedProgramIds,
    });
  });

  it("reports blind-sign with NO_CLEAR_SIGNING_CONTEXT when no unrecognized programs", async () => {
    const signReport = vi.fn().mockResolvedValue(undefined);
    const contextModule = makeContextModule(signReport);

    await new SolanaSigningReportTask({
      ...baseArgs,
      isBlindSign: true,
      unrecognizedProgramIds: [],
      contextModule,
    }).run();

    expect(signReport).toHaveBeenCalledOnce();
    const [params] = signReport.mock.calls[0]! as [SolSignReportParams];
    expect(params).toMatchObject({
      isBlindSign: true,
      blindSignReason: BlindSignReason.NO_CLEAR_SIGNING_CONTEXT,
    });
  });

  it("swallows errors from signReport", async () => {
    const signReport = vi.fn().mockRejectedValue(new Error("network error"));
    const contextModule = makeContextModule(signReport);

    await expect(
      new SolanaSigningReportTask({
        ...baseArgs,
        isBlindSign: false,
        contextModule,
      }).run(),
    ).resolves.toBeUndefined();
  });

  it("does nothing when signReport is not defined on the context module", async () => {
    const contextModule = makeContextModule(undefined);

    await expect(
      new SolanaSigningReportTask({
        ...baseArgs,
        isBlindSign: false,
        contextModule,
      }).run(),
    ).resolves.toBeUndefined();
  });
});

describe("SolanaSigningReportTask — extractProgramIds with real transaction", () => {
  it("filters ComputeBudget and reports the remaining program as programIds and targetAddress", async () => {
    const signReport = vi.fn().mockResolvedValue(undefined);
    const messageBytes = makeTx(COMPUTE_BUDGET_PROGRAM, KNOWN_PROGRAM);

    await new SolanaSigningReportTask({
      ...baseArgs,
      messageBytes,
      isBlindSign: false,
      contextModule: makeContextModule(signReport),
    }).run();

    const [params] = signReport.mock.calls[0]! as [SolSignReportParams];
    expect(params.programIds).toEqual([KNOWN_PROGRAM.toBase58()]);
    expect(params.targetAddress).toBe(KNOWN_PROGRAM.toBase58());
  });

  it("includes System program in programIds but selects the non-System program as targetAddress", async () => {
    const signReport = vi.fn().mockResolvedValue(undefined);
    const messageBytes = makeTx(SYSTEM_PROGRAM, KNOWN_PROGRAM);

    await new SolanaSigningReportTask({
      ...baseArgs,
      messageBytes,
      isBlindSign: false,
      contextModule: makeContextModule(signReport),
    }).run();

    const [params] = signReport.mock.calls[0]! as [SolSignReportParams];
    expect(params.programIds).toContain(SYSTEM_PROGRAM.toBase58());
    expect(params.programIds).toContain(KNOWN_PROGRAM.toBase58());
    expect(params.targetAddress).toBe(KNOWN_PROGRAM.toBase58());
  });

  it("returns null targetAddress when only System program is used", async () => {
    const signReport = vi.fn().mockResolvedValue(undefined);
    const messageBytes = makeTx(SYSTEM_PROGRAM);

    await new SolanaSigningReportTask({
      ...baseArgs,
      messageBytes,
      isBlindSign: false,
      contextModule: makeContextModule(signReport),
    }).run();

    const [params] = signReport.mock.calls[0]! as [SolSignReportParams];
    expect(params.programIds).toContain(SYSTEM_PROGRAM.toBase58());
    expect(params.targetAddress).toBeNull();
  });
});
