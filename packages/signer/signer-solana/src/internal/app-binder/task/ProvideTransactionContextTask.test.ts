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
import { NullLoggerPublisherService } from "@internal/app-binder/services/utils/NullLoggerPublisherService";

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
        loggerFactory: NullLoggerPublisherService,
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
        loggerFactory: NullLoggerPublisherService,
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
        loggerFactory: NullLoggerPublisherService,
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
        loggerFactory: NullLoggerPublisherService,
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
        loggerFactory: NullLoggerPublisherService,
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
        loggerFactory: NullLoggerPublisherService,
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
        loggerFactory: NullLoggerPublisherService,
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
        loggerFactory: NullLoggerPublisherService,
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
    it("sends one APDU per instruction in order (descriptor/empty/descriptor) after base + token are sent", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValue(success); // swap APDUs

      const message = {
        compiledInstructions: [
          { programIdIndex: 0 },
          { programIdIndex: 1 },
          { programIdIndex: 2 },
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
            A_PID: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
            // B missing -> empty
            C_PID: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: NullLoggerPublisherService,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as unknown as any,
        context as any,
      );

      // when
      const result = await task.run();

      // then
      expect(result).toStrictEqual(Nothing);
      // 2 base + 2 token + 3 swap
      expect(api.sendCommand).toHaveBeenCalledTimes(7);

      // swap calls start at index 4
      const c0 = api.sendCommand.mock.calls[4]![0]!;
      expect(c0).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c0.args.kind).toBe("descriptor");
      expect(c0.args.dataHex).toBe(SIG);
      expect(c0.args.signatureHex).toBe(SIG);
      expect(c0.args.isFirstMessage).toBe(true);
      expect(c0.args.swapSignatureTag).toBe(true);

      const c1 = api.sendCommand.mock.calls[5]![0]!;
      expect(c1).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(c1.args.kind).toBe("empty");
      expect(c1.args.isFirstMessage).toBe(false);
      expect(c1.args.swapSignatureTag).toBe(true);

      const c2 = api.sendCommand.mock.calls[6]![0]!;
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

    it("sends empty when descriptor exists but signatures[SWAP_MODE] is missing", async () => {
      // given
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token TLVTransactionInstructionDescriptor
        .mockResolvedValue(success);

      const message = {
        compiledInstructions: [{ programIdIndex: 0 }],
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
            ONLY_PID: {
              data: SIG,
              signatures: {
                // no [SWAP_MODE] key
              },
            },
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xca]),
        normaliser: normaliser as any,
        loggerFactory: NullLoggerPublisherService,
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
        compiledInstructions: [{ programIdIndex: 5 }], // out-of-range
        allKeys: [makeKey("X")],
      };
      const normaliser = buildNormaliser(message);

      const loadersResults = [
        {
          type: SolanaContextTypes.SOLANA_TOKEN,
          payload: { solanaTokenDescriptor: tokenDescriptor },
          certificate: tokenCert,
        },
        { type: SolanaContextTypes.SOLANA_LIFI, payload: {} },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xcc]),
        normaliser: normaliser as any,
        loggerFactory: NullLoggerPublisherService,
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
          { programIdIndex: 0 }, // descriptor
          { programIdIndex: 1 }, // empty -> rejects
          { programIdIndex: 2 }, // not reached
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
            A_PID: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
            // B missing -> empty
            C_PID: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0x1a]),
        normaliser: normaliser as any,
        loggerFactory: NullLoggerPublisherService,
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
        compiledInstructions: [{ programIdIndex: 0 }],
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
            SIG_PID: {
              data: SIG,
              signatures: { prod: "deadbeef", [SWAP_MODE]: SIG },
            },
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: new Uint8Array([0xf0]),
        normaliser: normaliser as any,
        loggerFactory: NullLoggerPublisherService,
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
            [SYSTEM_PID]: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
            // Tokenkeg missing -> empty
            [MEMO_PID]: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: raw,
        normaliser: DefaultSolanaMessageNormaliser,
        loggerFactory: NullLoggerPublisherService,
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
            [SYSTEM_PID]: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
            [ATA_PID]: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
            // Memo intentionally missing -> empty
          },
        },
      ];
      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: raw,
        normaliser: DefaultSolanaMessageNormaliser,
        loggerFactory: NullLoggerPublisherService,
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
            [SYSTEM_PID]: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
            [ATA_PID]: { data: SIG, signatures: { [SWAP_MODE]: SIG } },
            // Token Program intentionally missing -> "empty"
          },
        },
      ];

      const context = {
        trustedNamePKICertificate: baseCert,
        tlvDescriptor,
        loadersResults,
        transactionBytes: raw,
        normaliser: DefaultSolanaMessageNormaliser,
        loggerFactory: NullLoggerPublisherService,
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
});
