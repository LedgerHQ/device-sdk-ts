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

import {
  ProvideSolanaTransactionContextTask,
  SWAP_MODE,
} from "./ProvideTransactionContextTask";

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

describe("ProvideSolanaTransactionContextTask (merged)", () => {
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
      expect(fourth.args.kind).toBe("descriptor");
      expect(fourth.args.dataHex).toBe(tokenDescriptor.data);
      expect(fourth.args.signatureHex).toBe(tokenDescriptor.signature);
      expect(fourth.args.isFirstMessage).toBe(true);
      expect(fourth.args.swapSignatureTag).toBe(false);

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
      expect(tokenCmd.args.swapSignatureTag).toBe(false);
      expect(tokenCmd.args.isFirstMessage).toBe(true);
    });
  });

  // basic context + token + lifi (swap)
  describe("basic context + token + lifi", () => {
    it("sends swap template certificate then one APDU per instruction in order (descriptor/empty/descriptor) after base + token are sent", async () => {
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
              "A_PID:1": { data: SIG, signatures: { [SWAP_MODE]: SIG } },
              // B missing -> empty
              "C_PID:3": { data: SIG, signatures: { [SWAP_MODE]: SIG } },
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
      // 2 base + 2 token + 1 swap cert + 3 swap descriptors
      expect(api.sendCommand).toHaveBeenCalledTimes(8);

      // swap cert at index 4
      const certCmd = api.sendCommand.mock.calls[4]![0]!;
      expect(certCmd).toBeInstanceOf(LoadCertificateCommand);
      expect(certCmd.args.certificate).toStrictEqual(swapCert.payload);
      expect(certCmd.args.keyUsage).toBe(swapCert.keyUsageNumber);

      // swap descriptor calls start at index 5
      const c0 = api.sendCommand.mock.calls[5]![0]!;
      expect(c0).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c0.args.kind).toBe("descriptor");
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);

      const c1 = api.sendCommand.mock.calls[6]![0]!;
      expect(c1).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c1.args.kind).toBe("empty");
      expect(c1.args.isFirstMessage).toBe(false);
      expect(c1.args.swapSignatureTag).toBe(true);

      const c2 = api.sendCommand.mock.calls[7]![0]!;
      expect(c2).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c2.args.kind).toBe("descriptor");
      expect(c2.args.dataHex).toBe(SIG);
      expect(c2.args.signatureHex).toBe(SIG);
      expect(c2.args.isFirstMessage).toBe(false);
      expect(c2.args.swapSignatureTag).toBe(true);

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
              "A_PID:1": { data: SIG, signatures: { [SWAP_MODE]: SIG } },
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

    it("sends empty when descriptor exists but signatures[SWAP_MODE] is missing", async () => {
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
              "ONLY_PID:0": {
                data: SIG,
                signatures: {
                  // no [SWAP_MODE] key
                },
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
      // 2 base + 2 token + 1 swap
      expect(api.sendCommand).toHaveBeenCalledTimes(5);

      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c0.args.kind).toBe("empty");
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);
    });

    it("sends empty when programId is missing for an instruction", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValue(success);

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
      // 2 base + 2 token + 1 swap
      expect(api.sendCommand).toHaveBeenCalledTimes(5);

      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c0.args.kind).toBe("empty");
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);
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
          { programIdIndex: 0, data: new Uint8Array([0x01]) }, // descriptor
          { programIdIndex: 1, data: new Uint8Array([0x02]) }, // empty -> rejects
          { programIdIndex: 2, data: new Uint8Array([0x03]) }, // not reached
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
              "A_PID:1": { data: SIG, signatures: { [SWAP_MODE]: SIG } },
              // B missing -> empty
              "C_PID:3": { data: SIG, signatures: { [SWAP_MODE]: SIG } },
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
      expect(c0).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c0.args.kind).toBe("descriptor");
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c1.args.kind).toBe("empty");
      expect(c1.args.isFirstMessage).toBe(false);
      expect(c1.args.swapSignatureTag).toBe(true);
    });

    it("uses signatures[SWAP_MODE] specifically when present", async () => {
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
                signatures: { prod: "deadbeef", [SWAP_MODE]: SIG },
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
      expect(c0).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c0.args.kind).toBe("descriptor");
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);
    });

    it("parses a real *legacy* tx via DefaultSolanaMessageNormaliser and preserves APDU order (descriptor, empty, descriptor) after base + token", async () => {
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
              [`${SYSTEM_PID}:0`]: {
                data: SIG,
                signatures: { [SWAP_MODE]: SIG },
              },
              // Tokenkeg missing -> empty
              [`${MEMO_PID}:0`]: {
                data: SIG,
                signatures: { [SWAP_MODE]: SIG },
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
      // 2 base + 2 token + 3 swap
      expect(api.sendCommand).toHaveBeenCalledTimes(7);

      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0.args.kind).toBe("descriptor");
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1.args.kind).toBe("empty");
      expect(c1.args.isFirstMessage).toBe(false);
      expect(c1.args.swapSignatureTag).toBe(true);

      const c2 = api.sendCommand.mock.calls[6]![0]!;
      expect(c2.args.kind).toBe("descriptor");
      expect(c2.args.isFirstMessage).toBe(false);
      expect(c2.args.swapSignatureTag).toBe(true);
    });

    it("parses a real *v0* tx via DefaultSolanaMessageNormaliser (no ALTs) and preserves APDU order (descriptor, descriptor, empty) after base + token", async () => {
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
              [`${SYSTEM_PID}:0`]: {
                data: SIG,
                signatures: { [SWAP_MODE]: SIG },
              },
              [`${ATA_PID}:0`]: {
                data: SIG,
                signatures: { [SWAP_MODE]: SIG },
              },
              // Memo intentionally missing -> empty
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
      // 2 base + 2 token + 3 swap
      expect(api.sendCommand).toHaveBeenCalledTimes(7);

      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c0.args.kind).toBe("descriptor"); // System
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c1.args.kind).toBe("descriptor"); // ATA
      expect(c1.args.isFirstMessage).toBe(false);
      expect(c1.args.swapSignatureTag).toBe(true);

      const c2 = api.sendCommand.mock.calls[6]![0]!;
      expect(c2).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c2.args.kind).toBe("empty"); // Memo missing
      expect(c2.args.isFirstMessage).toBe(false);
      expect(c2.args.swapSignatureTag).toBe(true);
    });

    it("parses a real *v0* tx via DefaultSolanaMessageNormaliser and preserves APDU order System, createATA, token transfer (descriptor, descriptor, empty) after base + token", async () => {
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
              [`${SYSTEM_PID}:0`]: {
                data: SIG,
                signatures: { [SWAP_MODE]: SIG },
              },
              [`${ATA_PID}:0`]: {
                data: SIG,
                signatures: { [SWAP_MODE]: SIG },
              },
              // Token Program intentionally missing -> "empty"
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
      // 2 base + 2 token + 3 swap
      expect(api.sendCommand).toHaveBeenCalledTimes(7);

      // swap calls start at index 4
      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c0.args.kind).toBe("descriptor"); // System
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c1.args.kind).toBe("descriptor"); // ATA
      expect(c1.args.isFirstMessage).toBe(false);
      expect(c1.args.swapSignatureTag).toBe(true);

      const c2 = api.sendCommand.mock.calls[6]![0]!;
      expect(c2).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c2.args.kind).toBe("empty"); // Token Program missing
      expect(c2.args.isFirstMessage).toBe(false);
      expect(c2.args.swapSignatureTag).toBe(true);
    });
  });

  // real LiFi template payload (4c694669) with discriminator matching
  describe("real LiFi CAL payload (template 4c694669)", () => {
    // Helper to convert hex string to Uint8Array (with optional trailing data)
    const hexToData = (hex: string, extraBytes = 16): Uint8Array => {
      const padded = hex.length % 2 !== 0 ? "0" + hex : hex;
      const bytes = new Uint8Array(padded.length / 2 + extraBytes);
      for (let i = 0; i < padded.length; i += 2) {
        bytes[i / 2] = parseInt(padded.substring(i, i + 2), 16);
      }
      // fill remainder with dummy instruction data
      for (let i = padded.length / 2; i < bytes.length; i++) {
        bytes[i] = 0xab;
      }
      return bytes;
    };

    it("matches 12 instructions by program_id + discriminator (including 8-byte, 1-byte, and no discriminator)", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValue(success); // swap APDUs

      // Simulate 12 compiled instructions matching the LiFi template
      const message = {
        compiledInstructions: [
          { programIdIndex: 0, data: hexToData("01") }, // ATokenGP disc=1
          { programIdIndex: 1, data: hexToData("02") }, // System disc=2
          { programIdIndex: 2, data: hexToData("2aade37a97cb17e0") }, // JUP6 route (8 bytes)
          { programIdIndex: 2, data: hexToData("819cd641339b2148") }, // JUP6 shared (8 bytes)
          { programIdIndex: 3, data: hexToData("") }, // Memo (no disc)
          { programIdIndex: 0, data: hexToData("01") }, // ATokenGP disc=1 again
          { programIdIndex: 4, data: hexToData("") }, // 3i5JeuZ (no disc)
          { programIdIndex: 5, data: hexToData("02") }, // ComputeBudget disc=2
          { programIdIndex: 5, data: hexToData("03") }, // ComputeBudget disc=3
          { programIdIndex: 6, data: hexToData("03") }, // TokenkegQ disc=3
          { programIdIndex: 6, data: hexToData("11") }, // TokenkegQ disc=17
          { programIdIndex: 7, data: hexToData("") }, // BrdgN2 (no disc)
        ],
        allKeys: [
          makeKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), // 0
          makeKey("11111111111111111111111111111111"), // 1
          makeKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"), // 2
          makeKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), // 3
          makeKey("3i5JeuZuUxeKtVysUnwQNGerJP2bSMX9fTFfS4Nxe3Br"), // 4
          makeKey("ComputeBudget111111111111111111111111111111"), // 5
          makeKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // 6
          makeKey("BrdgN2RPzEMWF96ZbnnJaUtQDQx7VRXYaHHbYCBvceWB"), // 7
        ],
      };
      const normaliser = buildNormaliser(message);

      const mkDesc = (id: string) => ({
        data: `data_${id}`,
        signatures: { [SWAP_MODE]: `sig_${id}` },
      });

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: {
            descriptors: {
              "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL:1":
                mkDesc("atoken"),
              "11111111111111111111111111111111:2": mkDesc("system"),
              "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4:2aade37a97cb17e0":
                mkDesc("jup_route"),
              "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4:819cd641339b2148":
                mkDesc("jup_shared"),
              "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr:0": mkDesc("memo"),
              "3i5JeuZuUxeKtVysUnwQNGerJP2bSMX9fTFfS4Nxe3Br:0":
                mkDesc("3i5jeu"),
              "ComputeBudget111111111111111111111111111111:2": mkDesc("cb2"),
              "ComputeBudget111111111111111111111111111111:3": mkDesc("cb3"),
              "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA:3": mkDesc("tk3"),
              "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA:11": mkDesc("tk11"),
              "BrdgN2RPzEMWF96ZbnnJaUtQDQx7VRXYaHHbYCBvceWB:0": mkDesc("brdg"),
            },
            instructions: [
              {
                program_id: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
                discriminator_hex: "1",
              },
              {
                program_id: "11111111111111111111111111111111",
                discriminator_hex: "2",
              },
              {
                program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
                discriminator_hex: "2aade37a97cb17e0",
              },
              {
                program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
                discriminator_hex: "819cd641339b2148",
              },
              { program_id: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" },
              {
                program_id: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
                discriminator_hex: "1",
              },
              { program_id: "3i5JeuZuUxeKtVysUnwQNGerJP2bSMX9fTFfS4Nxe3Br" },
              {
                program_id: "ComputeBudget111111111111111111111111111111",
                discriminator_hex: "2",
              },
              {
                program_id: "ComputeBudget111111111111111111111111111111",
                discriminator_hex: "3",
              },
              {
                program_id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                discriminator_hex: "3",
              },
              {
                program_id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                discriminator_hex: "11",
              },
              { program_id: "BrdgN2RPzEMWF96ZbnnJaUtQDQx7VRXYaHHbYCBvceWB" },
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

      // 2 base + 12 swap APDUs
      expect(api.sendCommand).toHaveBeenCalledTimes(14);

      // All 12 should be "descriptor" (none missing)
      const swapCalls = api.sendCommand.mock.calls.slice(2);
      expect(swapCalls).toHaveLength(12);

      const expectedData = [
        "data_atoken", // ATokenGP disc=1
        "data_system", // System disc=2
        "data_jup_route", // JUP6 route (8-byte disc)
        "data_jup_shared", // JUP6 shared (8-byte disc)
        "data_memo", // Memo (no disc)
        "data_atoken", // ATokenGP disc=1 again
        "data_3i5jeu", // 3i5JeuZ (no disc)
        "data_cb2", // ComputeBudget disc=2
        "data_cb3", // ComputeBudget disc=3
        "data_tk3", // TokenkegQ disc=3
        "data_tk11", // TokenkegQ disc=17
        "data_brdg", // BrdgN2 (no disc)
      ];

      swapCalls.forEach(([cmd]: any, i: number) => {
        expect(cmd).toBeInstanceOf(
          ProvideTLVTransactionInstructionDescriptorCommand,
        );
        expect(cmd.args.kind).toBe("descriptor");
        expect(cmd.args.dataHex).toBe(expectedData[i]);
        expect(cmd.args.isFirstMessage).toBe(i === 0);
        expect(cmd.args.swapSignatureTag).toBe(true);
      });
    });
  });
});
