/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { SolanaContextTypes } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { Buffer } from "buffer";
import { Nothing } from "purify-ts";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideInstructionDescriptorCommand";
import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";
import { DefaultSolanaMessageNormaliser } from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

import { ProvideSolanaTransactionContextTask } from "./ProvideTransactionContextTask";

const DUMMY_BLOCKHASH = bs58.encode(new Uint8Array(32).fill(0xaa));

function makeSignedRawLegacy(
  ixs: TransactionInstruction[],
  signers: Keypair[],
  feePayer?: Keypair,
) {
  const payer = feePayer ?? signers[0] ?? Keypair.generate();
  const tx = new Transaction();
  tx.recentBlockhash = DUMMY_BLOCKHASH;
  tx.feePayer = payer.publicKey;
  tx.add(...ixs);
  const seen = new Set<string>();
  const uniq = [payer, ...signers].filter((kp) => {
    const k = kp.publicKey.toBase58();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  tx.sign(...uniq);
  return { raw: tx.serialize(), payer };
}

function makeSignedRawV0(
  ixs: TransactionInstruction[],
  signers: Keypair[],
  feePayer?: Keypair,
) {
  const payer = feePayer ?? signers[0] ?? Keypair.generate();
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: DUMMY_BLOCKHASH,
    instructions: ixs,
  }).compileToV0Message(); // no ALTs -> offline-safe

  const vtx = new VersionedTransaction(messageV0);
  vtx.sign([payer, ...signers]);
  return { raw: vtx.serialize(), payer };
}

const makeKey = (base58: string) => ({ toBase58: () => base58 });

const buildNormaliser = (message: any) =>
  ({
    normaliseMessage: vi.fn(async () => message),
  }) as const;

describe("ProvideSolanaTransactionContextTask", () => {
  let api: { sendCommand: Mock };
  const success = CommandResultFactory({ data: undefined });

  const baseCert = {
    payload: new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]),
    keyUsageNumber: 1,
  } as const;
  const tlvDescriptor = new Uint8Array([0xaa, 0xbb, 0xcc]);

  const tokenCert = {
    payload: new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]),
    keyUsageNumber: 2,
  } as const;

  const tokenDescriptor = {
    data: "f0cacc1a",
    signature: "01020304",
  } as const;

  const swapCert = {
    payload: new Uint8Array([0x01, 0x02, 0x03]),
    keyUsageNumber: 13,
  } as const;

  const SIG = "f0cacc1a";

  beforeEach(() => {
    vi.resetAllMocks();
    api = {
      sendCommand: vi.fn(),
    };
  });

  // basic context
  describe("basic context", () => {
    it("sends PKI certificate then TLV descriptor and returns Nothing (no loaders results)", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // LoadCertificateCommand (trusted name PKI)
        .mockResolvedValueOnce(success); // ProvideTLVDescriptorCommand

      const args = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults: [],
        transactionBytes: new Uint8Array([0xf0]), // unused in this path
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        args as any,
      );

      // when
      const result = await task.run();

      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(2);

      const first = api.sendCommand.mock.calls[0]![0]!;
      expect(first).toBeInstanceOf(LoadCertificateCommand);
      expect(first.args.certificate).toStrictEqual(baseCert.payload);
      expect(first.args.keyUsage).toBe(baseCert.keyUsageNumber);

      const second = api.sendCommand.mock.calls[1]![0]!;
      expect(second).toBeInstanceOf(ProvideTLVDescriptorCommand);
      expect(second.args.payload).toStrictEqual(tlvDescriptor);

      expect(result).toStrictEqual(Nothing);
    });

    it("propagates a rejection thrown by InternalApi.sendCommand", async () => {
      // given
      api.sendCommand.mockRejectedValueOnce(new Error("oupsy"));

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults: [],
        transactionBytes: new Uint8Array([0xca]),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      await expect(task.run()).rejects.toThrow("oupsy");
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
    });

    it("ignores SolanaContextTypes.ERROR entries (no extra APDUs beyond base context)", async () => {
      // given: include an ERROR loader which should be ignored
      api.sendCommand
        .mockResolvedValueOnce(success) // PKI
        .mockResolvedValueOnce(success); // TLV

      const loadersResults = [
        { type: SolanaContextTypes.ERROR, error: { message: "err" } as any },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0x1a]),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
      expect(api.sendCommand.mock.calls[0]![0]!).toBeInstanceOf(
        LoadCertificateCommand,
      );
      expect(api.sendCommand.mock.calls[1]![0]!).toBeInstanceOf(
        ProvideTLVDescriptorCommand,
      );
    });
  });

  // basic context + token metadata

  describe("basic context + token", () => {
    it("when token metadata present, sends token certificate then TLV transaction-instruction descriptor", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI certificate
        .mockResolvedValueOnce(success) // TLV descriptor
        .mockResolvedValueOnce(success) // token metadata certificate
        .mockResolvedValueOnce(success); // token descriptor via TLVTransactionInstructionDescriptor

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: {
            solanaTokenDescriptor: tokenDescriptor,
          },
          certificate: tokenCert,
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0x1a]), // unused in this path
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      // when
      const result = await task.run();

      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(4);

      const third = api.sendCommand.mock.calls[2]![0]!;
      expect(third).toBeInstanceOf(LoadCertificateCommand);
      expect(third.args.certificate).toStrictEqual(tokenCert.payload);
      expect(third.args.keyUsage).toBe(tokenCert.keyUsageNumber);

      const fourth = api.sendCommand.mock.calls[3]![0]!;
      expect(fourth).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(fourth.args.dataHex).toBe(tokenDescriptor.data);
      expect(fourth.args.signatureHex).toBe(tokenDescriptor.signature);

      expect(result).toStrictEqual(Nothing);
    });

    it("does not send token commands if token payload is missing", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // PKI
        .mockResolvedValueOnce(success); // TLV

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: undefined,
          certificate: tokenCert,
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      // when
      const result = await task.run();

      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
      expect(result).toStrictEqual(Nothing);
    });

    it("does not send token commands if token certificate is missing", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // PKI
        .mockResolvedValueOnce(success); // TLV

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: undefined,
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xca]),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      // when
      const result = await task.run();

      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
      expect(result).toStrictEqual(Nothing);
    });

    it("throws a mapped error when sending token certificate returns a CommandErrorResult", async () => {
      // given
      const errorResult = CommandResultFactory({
        error: { _tag: "SomeError", errorCode: 0x6a80, message: "bad" },
      });

      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(errorResult); // token certificate -> error

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xcc]),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      // when + then
      await expect(task.run()).rejects.toThrow(
        "[SignerSolana] ProvideSolanaTransactionContextTask: Failed to send tokenMetadataCertificate to device, latest firmware version required",
      );

      // ensure the TLVTransactionInstructionDescriptor was NOT attempted
      expect(api.sendCommand).toHaveBeenCalledTimes(3);
      const third = api.sendCommand.mock.calls[2]![0]!;
      expect(third).toBeInstanceOf(LoadCertificateCommand);
    });

    it("does not send swap APDUs when SOLANA_LIFI context is missing (token present)", async () => {
      // given: base + token succeed, but no LIFI in loadersResults
      api.sendCommand
        .mockResolvedValueOnce(success) // PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success); // token TLVTransactionInstructionDescriptor

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        // no SOLANA_LIFI entry
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0x1a]),
        normaliser: { normaliseMessage: vi.fn() } as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base + 2 token only
      expect(api.sendCommand).toHaveBeenCalledTimes(4);
      expect(api.sendCommand.mock.calls[0]![0]!).toBeInstanceOf(
        LoadCertificateCommand,
      );
      expect(api.sendCommand.mock.calls[1]![0]!).toBeInstanceOf(
        ProvideTLVDescriptorCommand,
      );
      expect(api.sendCommand.mock.calls[2]![0]!).toBeInstanceOf(
        LoadCertificateCommand,
      );
      const tokenCmd = api.sendCommand.mock.calls[3]![0]!;
      expect(tokenCmd).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
    });
  });

  // basic context + token + lifi (swap)
  describe("basic context + token + lifi", () => {
    it("sends swap template certificate then one APDU per matched instruction (skipping unmatched) after base + token are sent", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValueOnce(success) // swap template cert
        .mockResolvedValue(success); // swap APDUs

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0x01]) },
          { programIdIndex: 1, data: new Uint8Array([0x02]) },
          { programIdIndex: 2, data: new Uint8Array([0x03]) },
        ],
        allKeys: [makeKey("A_PID"), makeKey("B_PID"), makeKey("C_PID")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "A_PID:1": { data: SIG, signature: SIG },
              // B missing -> skipped
              "C_PID:3": { data: SIG, signature: SIG },
            },
            instructions: [
              { program_id: "A_PID", discriminator_hex: "1" },
              { program_id: "C_PID", discriminator_hex: "3" },
            ],
          },
          certificate: swapCert,
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      // when
      const result = await task.run();

      // then
      expect(result).toStrictEqual(Nothing);
      // 2 base + 2 token + 1 swap cert + 2 swap descriptors
      expect(api.sendCommand).toHaveBeenCalledTimes(7);

      // swap cert at index 4
      const certCmd = api.sendCommand.mock.calls[4]![0]!;
      expect(certCmd).toBeInstanceOf(LoadCertificateCommand);
      expect(certCmd.args.certificate).toStrictEqual(swapCert.payload);
      expect(certCmd.args.keyUsage).toBe(swapCert.keyUsageNumber);

      // swap descriptor calls start at index 5
      const c0 = api.sendCommand.mock.calls[5]![0]!;
      expect(c0).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);

      const c1 = api.sendCommand.mock.calls[6]![0]!;
      expect(c1).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c1.args.dataHex).toBe(SIG);
      expect(c1.args.signatureHex).toBe(SIG);

      expect((normaliser as any).normaliseMessage).toHaveBeenCalledOnce();
    });

    it("throws when sending swap template certificate returns a CommandErrorResult", async () => {
      const errorResult = CommandResultFactory({
        error: { _tag: "SomeError", errorCode: 0x6a80, message: "bad" },
      });

      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValueOnce(errorResult); // swap template cert -> error

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0x01]) },
        ],
        allKeys: [makeKey("A_PID")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "A_PID:1": { data: SIG, signature: SIG },
            },
            instructions: [{ program_id: "A_PID", discriminator_hex: "1" }],
          },
          certificate: swapCert,
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      await expect(task.run()).rejects.toThrow(
        "[SignerSolana] ProvideSolanaTransactionContextTask: Failed to send swapTemplateCertificate to device",
      );

      // 2 base + 2 token + 1 swap cert (failed)
      expect(api.sendCommand).toHaveBeenCalledTimes(5);
    });

    it("sends no swap APDU when signature is an empty string", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success); // token TLVTransactionInstructionDescriptor

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0x01]) },
        ],
        allKeys: [makeKey("ONLY_PID")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "ONLY_PID:": {
                data: SIG,
                signature: "",
              },
            },
            instructions: [{ program_id: "ONLY_PID" }],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xca]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base + 2 token (no swap APDUs since signature is empty)
      expect(api.sendCommand).toHaveBeenCalledTimes(4);
    });

    it("sends no swap APDU when programId is missing for an instruction", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success); // token TLVTransactionInstructionDescriptor

      const message = {
        compiledInstructions: [{ programIdIndex: 5, data: new Uint8Array() }], // out-of-range
        allKeys: [makeKey("X")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: { descriptors: {}, instructions: [] },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xcc]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base + 2 token (no swap APDUs since programId is missing)
      expect(api.sendCommand).toHaveBeenCalledTimes(4);
    });

    it("propagates a rejection thrown by InternalApi.sendCommand on the second swap APDU (after base + token succeed)", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValueOnce(success) // 1st swap ok
        .mockRejectedValueOnce(new Error("err")); // 2nd swap fails

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0x01]) }, // descriptor A
          { programIdIndex: 1, data: new Uint8Array([0x02]) }, // no match -> skipped
          { programIdIndex: 2, data: new Uint8Array([0x03]) }, // descriptor C -> rejects
        ],
        allKeys: [makeKey("A_PID"), makeKey("B_PID"), makeKey("C_PID")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "A_PID:1": { data: SIG, signature: SIG },
              // B missing -> skipped
              "C_PID:3": { data: SIG, signature: SIG },
            },
            instructions: [
              { program_id: "A_PID", discriminator_hex: "1" },
              { program_id: "C_PID", discriminator_hex: "3" },
            ],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0x1a]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      await expect(task.run()).rejects.toThrow("err");
      // 2 base + 2 token + 2 swap (failed on 2nd)
      expect(api.sendCommand).toHaveBeenCalledTimes(6);

      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c1.args.dataHex).toBe(SIG);
      expect(c1.args.signatureHex).toBe(SIG);
    });

    it("uses the pre-resolved signature field from the descriptor", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValue(success);

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0x01]) },
        ],
        allKeys: [makeKey("SIG_PID")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "SIG_PID:1": {
                data: SIG,
                signature: SIG,
              },
            },
            instructions: [{ program_id: "SIG_PID", discriminator_hex: "1" }],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base + 2 token + 1 swap
      expect(api.sendCommand).toHaveBeenCalledTimes(5);

      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);
    });

    it("parses a real *legacy* tx via DefaultSolanaMessageNormaliser and sends matched descriptors (skipping unmatched) after base + token", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValue(success);

      const payer = Keypair.generate();
      const dest1 = Keypair.generate().publicKey;
      const ix1 = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: dest1,
        lamports: 1234,
      });

      const owner = Keypair.generate();
      const srcToken = Keypair.generate().publicKey;
      const dstToken = Keypair.generate().publicKey;
      const ix2 = createTransferInstruction(
        srcToken,
        dstToken,
        owner.publicKey,
        42n,
        [],
        TOKEN_PROGRAM_ID,
      );

      const MEMO_PROGRAM_ID = new PublicKey(
        "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
      );
      const ix3 = new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: Buffer.from("hi"),
      });

      const { raw } = makeSignedRawLegacy(
        [ix1, ix2, ix3],
        [payer, owner],
        payer,
      );

      const SYSTEM_PID = SystemProgram.programId.toBase58();
      const MEMO_PID = MEMO_PROGRAM_ID.toBase58();

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              [`${SYSTEM_PID}:`]: {
                data: SIG,
                signature: SIG,
              },
              // Tokenkeg missing -> skipped
              [`${MEMO_PID}:`]: {
                data: SIG,
                signature: SIG,
              },
            },
            instructions: [
              { program_id: SYSTEM_PID },
              { program_id: MEMO_PID },
            ],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: raw,
        normaliser: new DefaultSolanaMessageNormaliser(),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base + 2 token + 2 swap descriptors
      expect(api.sendCommand).toHaveBeenCalledTimes(6);

      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c1.args.dataHex).toBe(SIG);
      expect(c1.args.signatureHex).toBe(SIG);
    });

    it("parses a real *v0* tx via DefaultSolanaMessageNormaliser (no ALTs) and sends matched descriptors (skipping unmatched) after base + token", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValue(success);

      const payer = Keypair.generate();
      const sysDest = Keypair.generate().publicKey;
      const sysIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: sysDest,
        lamports: 5_678,
      });

      const owner = Keypair.generate().publicKey;
      const mint = Keypair.generate().publicKey;
      const ata = getAssociatedTokenAddressSync(
        mint,
        owner,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const ataIx = createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const MEMO_PROGRAM_ID = new PublicKey(
        "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
      );
      const memoIx = new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: Buffer.from("hello"),
      });

      // IMPORTANT: sign only with the payer (no PublicKey in signers array)
      const { raw } = makeSignedRawV0([sysIx, ataIx, memoIx], [], payer);

      const SYSTEM_PID = SystemProgram.programId.toBase58();
      const ATA_PID = ASSOCIATED_TOKEN_PROGRAM_ID.toBase58();

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              [`${SYSTEM_PID}:`]: {
                data: SIG,
                signature: SIG,
              },
              [`${ATA_PID}:`]: {
                data: SIG,
                signature: SIG,
              },
              // Memo intentionally missing -> skipped
            },
            instructions: [{ program_id: SYSTEM_PID }, { program_id: ATA_PID }],
          },
        },
      ];
      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: raw,
        normaliser: new DefaultSolanaMessageNormaliser(),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        context as any,
      );

      const res = await task.run();

      expect(res).toEqual(Nothing);
      // 2 base + 2 token + 2 swap descriptors
      expect(api.sendCommand).toHaveBeenCalledTimes(6);

      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c1.args.dataHex).toBe(SIG);
      expect(c1.args.signatureHex).toBe(SIG);
    });

    it("parses a real *v0* tx via DefaultSolanaMessageNormaliser: System, createATA, token transfer (sends matched, skips unmatched) after base + token", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValue(success); // swap APDUs

      const payer = Keypair.generate();

      const sysDest = Keypair.generate().publicKey;
      const sysIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: sysDest,
        lamports: 7_777,
      });

      const tokenOwner = Keypair.generate(); // owner of the source SPL token account (signer)
      const mint = Keypair.generate().publicKey;

      const recipientOwner = Keypair.generate().publicKey; // unfunded account (no ATA yet)
      const recipientATA = getAssociatedTokenAddressSync(
        mint,
        recipientOwner,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const createAtaIx = createAssociatedTokenAccountInstruction(
        payer.publicKey, // funder
        recipientATA, // ata to be created
        recipientOwner, // owner of the ATA
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const srcTokenAcc = Keypair.generate().publicKey; // pretend this is an existing token account
      const transferIx = createTransferInstruction(
        srcTokenAcc,
        recipientATA,
        tokenOwner.publicKey, // authority of srcTokenAcc (we will sign with tokenOwner)
        9n,
        [],
        TOKEN_PROGRAM_ID,
      );

      // sign v0 with payer + tokenOwner (NO PublicKey objects in the signers array)
      const { raw } = makeSignedRawV0(
        [sysIx, createAtaIx, transferIx],
        [tokenOwner],
        payer,
      );

      const SYSTEM_PID = SystemProgram.programId.toBase58();
      const ATA_PID = ASSOCIATED_TOKEN_PROGRAM_ID.toBase58();

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              [`${SYSTEM_PID}:`]: {
                data: SIG,
                signature: SIG,
              },
              [`${ATA_PID}:`]: {
                data: SIG,
                signature: SIG,
              },
              // Token Program intentionally missing -> skipped
            },
            instructions: [{ program_id: SYSTEM_PID }, { program_id: ATA_PID }],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: raw,
        normaliser: new DefaultSolanaMessageNormaliser(),
        loggerFactory: mockLoggerFactory,
      };

      // when
      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        context as any,
      );

      const res = await task.run();

      // then
      expect(res).toEqual(Nothing);
      // 2 base + 2 token + 2 swap descriptors
      expect(api.sendCommand).toHaveBeenCalledTimes(6);

      // swap calls start at index 4
      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c1.args.dataHex).toBe(SIG);
      expect(c1.args.signatureHex).toBe(SIG);
    });

    it("selects the correct descriptor when a program_id has multiple discriminator candidates", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token descriptor
        .mockResolvedValue(success); // swap APDUs

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0xbb, 0xcc, 0x00]) },
          { programIdIndex: 0, data: new Uint8Array([0xaa, 0xff, 0x00]) },
        ],
        allKeys: [makeKey("MULTI")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "MULTI:aaff": {
                data: "data_aa",
                signature: SIG,
              },
              "MULTI:bbcc": {
                data: "data_bb",
                signature: SIG,
              },
            },
            instructions: [
              { program_id: "MULTI", discriminator_hex: "aaff" },
              { program_id: "MULTI", discriminator_hex: "bbcc" },
            ],
          },
          certificate: swapCert,
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base + 2 token + 1 swap cert + 2 swap descriptors
      expect(api.sendCommand).toHaveBeenCalledTimes(7);

      const c0 = api.sendCommand.mock.calls[5]![0]!;
      expect(c0).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c0.args.dataHex).toBe("data_bb");

      const c1 = api.sendCommand.mock.calls[6]![0]!;
      expect(c1).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(c1.args.dataHex).toBe("data_aa");
    });
  });

  describe("edge cases", () => {
    it("skips base context when trustedNamePKICertificate is missing", async () => {
      api.sendCommand.mockResolvedValue(success);

      const context = {
        trustedNamePKICertificate: undefined,
        tlvDescriptor: undefined,
        loadersResults: [],
        transactionBytes: new Uint8Array([0xf0]),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      expect(api.sendCommand).toHaveBeenCalledTimes(0);
    });

    it("skips unknown loader types via the default case", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success);

      const loadersResults = [{ type: "SOME_FUTURE_TYPE" as any, payload: {} }];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // only 2 base context commands, unknown loader type was skipped
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
    });

    it("skips swap flow entirely when lifiDescriptors is falsy", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: undefined as any,
            instructions: [],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: { normaliseMessage: vi.fn() } as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // only 2 base context commands, swap was skipped
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
      expect(context.normaliser.normaliseMessage).not.toHaveBeenCalled();
    });

    it("skips certificate loading but still processes instructions when swapTemplateCertificate is missing", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success)
        .mockResolvedValue(success);

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0x01]) },
        ],
        allKeys: [makeKey("P1")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "P1:1": { data: SIG, signature: SIG },
            },
            instructions: [{ program_id: "P1", discriminator_hex: "1" }],
          },
          certificate: undefined,
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base + 1 swap descriptor (no swap cert)
      expect(api.sendCommand).toHaveBeenCalledTimes(3);

      const swapCmd = api.sendCommand.mock.calls[2]![0]!;
      expect(swapCmd).toBeInstanceOf(ProvideInstructionDescriptorCommand);
      expect(swapCmd.args.dataHex).toBe(SIG);
    });

    it("returns undefined when discriminator matches but descriptor key is not in the map", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success);

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0x01]) },
        ],
        allKeys: [makeKey("PROG")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              // key "PROG:1" deliberately absent despite the instruction meta listing it
            },
            instructions: [{ program_id: "PROG", discriminator_hex: "1" }],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base only, no swap APDU because descriptor map entry is missing
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
    });

    it("skips instruction when its data is shorter than the discriminator", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success);

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0x2a]) }, // 1 byte, but disc is 4 bytes
        ],
        allKeys: [makeKey("SHORT")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "SHORT:2aade37a": {
                data: SIG,
                signature: SIG,
              },
            },
            instructions: [
              { program_id: "SHORT", discriminator_hex: "2aade37a" },
            ],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base only, no swap APDU because instruction data is too short for the discriminator
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
    });

    it("skips instruction when discriminator bytes do not match the instruction data prefix", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success);

      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) },
        ],
        allKeys: [makeKey("MISMATCH")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "MISMATCH:aabbccdd": {
                data: SIG,
                signature: SIG,
              },
            },
            instructions: [
              { program_id: "MISMATCH", discriminator_hex: "aabbccdd" },
            ],
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: mockLoggerFactory,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      // 2 base only, no swap APDU because discriminator 0xaabbccdd != data prefix 0xffeeddcc
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
    });
  });
});
