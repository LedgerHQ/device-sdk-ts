/* eslint-disable @typescript-eslint/no-explicit-any */

import { SolanaContextTypes } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { Nothing } from "purify-ts";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

import { ProvideSolanaTransactionContextTask } from "./ProvideTransactionContextTask";

describe("ProvideSolanaTransactionContextTask", () => {
  let api: { sendCommand: Mock };
  const success = CommandResultFactory({ data: undefined });

  const baseCert = {
    payload: new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]),
    keyUsageNumber: 1,
  } as const;
  const tlvDescriptor = new Uint8Array([0xaa, 0xbb, 0xcc]);

  beforeEach(() => {
    vi.resetAllMocks();
    api = { sendCommand: vi.fn() };
  });

  describe("base context", () => {
    it("sends PKI certificate then TLV descriptor and returns Nothing (no loaders)", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success);

      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        {
          trustedNamePKICertificate: baseCert,
          tlvDescriptor,
          loadersResults: [],
          transactionBytes: new Uint8Array([0xf0]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      expect(api.sendCommand).toHaveBeenCalledTimes(2);

      const first = api.sendCommand.mock.calls[0]![0]!;
      expect(first).toBeInstanceOf(LoadCertificateCommand);
      expect(first.args.certificate).toStrictEqual(baseCert.payload);
      expect(first.args.keyUsage).toBe(baseCert.keyUsageNumber);

      const second = api.sendCommand.mock.calls[1]![0]!;
      expect(second).toBeInstanceOf(ProvideTLVDescriptorCommand);
      expect(second.args.payload).toStrictEqual(tlvDescriptor);
    });

    it("skips base context when trustedNamePKICertificate is missing", async () => {
      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        {
          trustedNamePKICertificate: undefined,
          tlvDescriptor: undefined,
          loadersResults: [],
          transactionBytes: new Uint8Array([0xf0]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      expect(api.sendCommand).not.toHaveBeenCalled();
    });

    it("propagates a rejection thrown by sendCommand", async () => {
      api.sendCommand.mockRejectedValueOnce(new Error("transport fail"));

      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        {
          trustedNamePKICertificate: baseCert,
          tlvDescriptor,
          loadersResults: [],
          transactionBytes: new Uint8Array([0xca]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      await expect(task.run()).rejects.toThrow("transport fail");
    });
  });

  describe("loaders dispatch", () => {
    it("skips ERROR entries without sending extra commands", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success);

      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        {
          trustedNamePKICertificate: baseCert,
          tlvDescriptor,
          loadersResults: [
            {
              type: SolanaContextTypes.ERROR,
              error: { message: "err" } as any,
            },
          ],
          transactionBytes: new Uint8Array([0x1a]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      const result = await task.run();

      expect(result).toStrictEqual(Nothing);
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
    });

    it("dispatches SOLANA_TOKEN result to the token handler", async () => {
      api.sendCommand.mockResolvedValue(success);

      const tokenCert = {
        payload: new Uint8Array([0x01]),
        keyUsageNumber: 2,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        {
          trustedNamePKICertificate: baseCert,
          tlvDescriptor,
          loadersResults: [
            {
              type: SolanaContextTypes.SOLANA_TOKEN,
              payload: {
                solanaTokenDescriptor: { data: "aa", signature: "bb" },
              },
              certificate: tokenCert,
            },
          ],
          transactionBytes: new Uint8Array([0xf0]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      await task.run();

      // 2 base + 2 token (cert + descriptor)
      expect(api.sendCommand).toHaveBeenCalledTimes(4);
      expect(api.sendCommand.mock.calls[2]![0]!).toBeInstanceOf(
        LoadCertificateCommand,
      );
      expect(api.sendCommand.mock.calls[3]![0]!).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
    });

    it("dispatches SOLANA_LIFI result to the lifi handler", async () => {
      api.sendCommand.mockResolvedValue(success);

      const makeKey = (b58: string) => ({ toBase58: () => b58 });
      const normaliser = {
        normaliseMessage: vi.fn(async () => ({
          compiledInstructions: [
            { programIdIndex: 0, data: new Uint8Array([0x01]) },
          ],
          allKeys: [makeKey("PID")],
        })),
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        {
          trustedNamePKICertificate: baseCert,
          tlvDescriptor,
          loadersResults: [
            {
              type: SolanaContextTypes.SOLANA_LIFI,
              payload: {
                descriptors: {
                  "PID:1": { data: "aa", signature: "bb" },
                },
                instructions: [{ program_id: "PID", discriminator_hex: "1" }],
              },
              certificate: undefined,
            },
          ],
          transactionBytes: new Uint8Array([0xf0]),
          normaliser,
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      await task.run();

      // 2 base + 1 swap descriptor (no cert)
      expect(api.sendCommand).toHaveBeenCalledTimes(3);
      expect(normaliser.normaliseMessage).toHaveBeenCalledOnce();
    });

    it("dispatches TRANSACTION_CHECK result to the transaction-check handler", async () => {
      api.sendCommand.mockResolvedValue(success);

      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        {
          trustedNamePKICertificate: undefined,
          tlvDescriptor: undefined,
          loadersResults: [
            {
              type: SolanaContextTypes.TRANSACTION_CHECK,
              payload: { descriptor: "aabb" },
              certificate: {
                payload: new Uint8Array([0xde]),
                keyUsageNumber: 14,
              },
            },
          ],
          transactionBytes: new Uint8Array([0xf0]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      await task.run();

      // 1 cert + 1 ProvideWeb3CheckCommand
      expect(api.sendCommand).toHaveBeenCalledTimes(2);
      expect(api.sendCommand.mock.calls[0]![0]!).toBeInstanceOf(
        LoadCertificateCommand,
      );
      expect(api.sendCommand.mock.calls[1]![0]!).toBeInstanceOf(
        ProvideWeb3CheckCommand,
      );
    });

    it("processes multiple loader results in order", async () => {
      api.sendCommand.mockResolvedValue(success);

      const tokenCert = {
        payload: new Uint8Array([0x01]),
        keyUsageNumber: 2,
      };

      const task = new ProvideSolanaTransactionContextTask(
        api as any,
        {
          trustedNamePKICertificate: baseCert,
          tlvDescriptor,
          loadersResults: [
            { type: SolanaContextTypes.ERROR, error: { message: "x" } as any },
            {
              type: SolanaContextTypes.SOLANA_TOKEN,
              payload: {
                solanaTokenDescriptor: { data: "aa", signature: "bb" },
              },
              certificate: tokenCert,
            },
            {
              type: SolanaContextTypes.TRANSACTION_CHECK,
              payload: { descriptor: "ccdd" },
              certificate: undefined,
            },
          ],
          transactionBytes: new Uint8Array([0xf0]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      await task.run();

      // 2 base + 2 token + 1 tx-check (ERROR skipped, no tx-check cert)
      expect(api.sendCommand).toHaveBeenCalledTimes(5);
    });
  });
});
