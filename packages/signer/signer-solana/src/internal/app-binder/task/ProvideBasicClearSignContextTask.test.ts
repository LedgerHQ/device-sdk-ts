/* eslint-disable @typescript-eslint/no-explicit-any */

import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";

import { ProvideBasicClearSignContextTask } from "./ProvideBasicClearSignContextTask";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const buildNormaliser = (message: any) =>
  ({ normaliseMessage: vi.fn(async () => message) }) as const;

describe("ProvideBasicClearSignContextTask", () => {
  let api: { sendCommand: Mock };
  const success = CommandResultFactory({ data: undefined });

  const baseCert = {
    payload: new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]),
    keyUsageNumber: 1,
  } as const;
  const tlvDescriptor = new Uint8Array([0xaa, 0xbb, 0xcc]);

  const tokenCert = {
    payload: new Uint8Array([0x01, 0x02]),
    keyUsageNumber: 2,
  } as const;
  const tokenDescriptor = {
    data: "f0cacc1a",
    signature: "01020304",
  } as const;

  const txCheckCert = {
    payload: new Uint8Array([0xde, 0xad]),
    keyUsageNumber: 14,
  } as const;

  beforeEach(() => {
    vi.resetAllMocks();
    api = { sendCommand: vi.fn() };
  });

  describe("base context (trusted-name)", () => {
    it("sends PKI certificate then TLV descriptor when both are provided", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success)
        .mockResolvedValueOnce(success);

      const task = new ProvideBasicClearSignContextTask(
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

      expect(result).toBeUndefined();
      expect(api.sendCommand).toHaveBeenCalledTimes(2);

      const certCmd = api.sendCommand.mock.calls[0]![0]!;
      expect(certCmd).toBeInstanceOf(LoadCertificateCommand);
      expect(certCmd.args.certificate).toStrictEqual(baseCert.payload);
      expect(certCmd.args.keyUsage).toBe(baseCert.keyUsageNumber);

      const tlvCmd = api.sendCommand.mock.calls[1]![0]!;
      expect(tlvCmd).toBeInstanceOf(ProvideTLVDescriptorCommand);
      expect(tlvCmd.args.payload).toStrictEqual(tlvDescriptor);
    });

    it("skips base context APDUs when trustedNamePKICertificate is missing", async () => {
      const task = new ProvideBasicClearSignContextTask(
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

      expect(result).toBeUndefined();
      expect(api.sendCommand).not.toHaveBeenCalled();
    });

    it("propagates errors thrown by sendCommand", async () => {
      api.sendCommand.mockRejectedValueOnce(new Error("transport fail"));

      const task = new ProvideBasicClearSignContextTask(
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
    it("returns Nothing when loadersResults is empty", async () => {
      const task = new ProvideBasicClearSignContextTask(
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

      expect(result).toBeUndefined();
      expect(api.sendCommand).not.toHaveBeenCalled();
    });

    it("skips ERROR loader results without sending APDUs", async () => {
      const task = new ProvideBasicClearSignContextTask(
        api as any,
        {
          trustedNamePKICertificate: undefined,
          tlvDescriptor: undefined,
          loadersResults: [
            {
              type: ClearSignContextType.ERROR,
              error: new Error("loader failed"),
            },
          ],
          transactionBytes: new Uint8Array([0xf0]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      const result = await task.run();

      expect(result).toBeUndefined();
      expect(api.sendCommand).not.toHaveBeenCalled();
    });

    it("dispatches SOLANA_TOKEN result to the token handler (cert + descriptor APDUs)", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV descriptor
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success); // token descriptor

      const task = new ProvideBasicClearSignContextTask(
        api as any,
        {
          trustedNamePKICertificate: baseCert,
          tlvDescriptor,
          loadersResults: [
            {
              type: ClearSignContextType.SOLANA_TOKEN as const,
              payload: { solanaTokenDescriptor: tokenDescriptor },
              certificate: tokenCert,
            },
          ],
          transactionBytes: new Uint8Array([0x1a]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      await task.run();

      expect(api.sendCommand).toHaveBeenCalledTimes(4);

      const tokenCertCmd = api.sendCommand.mock.calls[2]![0]!;
      expect(tokenCertCmd).toBeInstanceOf(LoadCertificateCommand);
      expect(tokenCertCmd.args.certificate).toStrictEqual(tokenCert.payload);

      const tokenDescCmd = api.sendCommand.mock.calls[3]![0]!;
      expect(tokenDescCmd).toBeInstanceOf(
        ProvideTLVTransactionInstructionDescriptorCommand,
      );
      expect(tokenDescCmd.args.dataHex).toBe(tokenDescriptor.data);
      expect(tokenDescCmd.args.signatureHex).toBe(tokenDescriptor.signature);
    });

    it("dispatches SOLANA_TRANSACTION_CHECK result to the web3-check handler", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success) // tx-check cert
        .mockResolvedValueOnce(success); // descriptor chunk

      const task = new ProvideBasicClearSignContextTask(
        api as any,
        {
          trustedNamePKICertificate: undefined,
          tlvDescriptor: undefined,
          loadersResults: [
            {
              type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
              payload: { descriptor: "aabbccdd" },
              certificate: txCheckCert,
            },
          ],
          transactionBytes: new Uint8Array([0xf0]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      await task.run();

      expect(api.sendCommand).toHaveBeenCalledTimes(2);

      const certCmd = api.sendCommand.mock.calls[0]![0]!;
      expect(certCmd).toBeInstanceOf(LoadCertificateCommand);
      expect(certCmd.args.certificate).toStrictEqual(txCheckCert.payload);
      expect(certCmd.args.keyUsage).toBe(txCheckCert.keyUsageNumber);

      const web3Cmd = api.sendCommand.mock.calls[1]![0]!;
      expect(web3Cmd).toBeInstanceOf(ProvideWeb3CheckCommand);
    });

    it("dispatches multiple loader results in order", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success) // base PKI
        .mockResolvedValueOnce(success) // TLV descriptor
        .mockResolvedValueOnce(success) // token cert
        .mockResolvedValueOnce(success) // token descriptor
        .mockResolvedValueOnce(success) // tx-check cert
        .mockResolvedValueOnce(success); // tx-check descriptor

      const task = new ProvideBasicClearSignContextTask(
        api as any,
        {
          trustedNamePKICertificate: baseCert,
          tlvDescriptor,
          loadersResults: [
            {
              type: ClearSignContextType.SOLANA_TOKEN as const,
              payload: { solanaTokenDescriptor: tokenDescriptor },
              certificate: tokenCert,
            },
            {
              type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
              payload: { descriptor: "aabbccdd" },
              certificate: txCheckCert,
            },
          ],
          transactionBytes: new Uint8Array([0xca]),
          loggerFactory: mockLoggerFactory,
          normaliser: buildNormaliser({}) as any,
        } as any,
      );

      await task.run();

      expect(api.sendCommand).toHaveBeenCalledTimes(6);
    });

    it("ignores ERROR entries while still dispatching subsequent success entries", async () => {
      api.sendCommand
        .mockResolvedValueOnce(success) // tx-check cert
        .mockResolvedValueOnce(success); // tx-check descriptor

      const task = new ProvideBasicClearSignContextTask(
        api as any,
        {
          trustedNamePKICertificate: undefined,
          tlvDescriptor: undefined,
          loadersResults: [
            {
              type: ClearSignContextType.ERROR,
              error: new Error("first loader failed"),
            },
            {
              type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
              payload: { descriptor: "aabbccdd" },
              certificate: txCheckCert,
            },
          ],
          transactionBytes: new Uint8Array([0xf0]),
          loggerFactory: mockLoggerFactory,
        } as any,
      );

      await task.run();

      expect(api.sendCommand).toHaveBeenCalledTimes(2);
      expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
        LoadCertificateCommand,
      );
      expect(api.sendCommand.mock.calls[1]![0]).toBeInstanceOf(
        ProvideWeb3CheckCommand,
      );
    });
  });
});
