import bs58 from "bs58";
import { Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import { dispatchTransactionCheckScanHandler } from "./transactionCheckScanHandlerRegistry";
import {
  WEB3CHECKS_ETHEREUM_TX_SCAN_PATH,
  WEB3CHECKS_SOLANA_TX_SCAN_PATH,
} from "./web3CheckScanPaths";

describe("dispatchTransactionCheckScanHandler", () => {
  describe("routing", () => {
    it("routes ethereum kind to the ethereum path and payload shape", async () => {
      const postScan = vi
        .fn()
        .mockResolvedValue(Right({ publicKeyId: "pk", descriptor: "d" }));

      await dispatchTransactionCheckScanHandler(
        {
          kind: "ethereum",
          chainId: 1,
          from: "0x1234567890123456789012345678901234567890",
          rawTx: "0xab",
        },
        postScan,
      );

      expect(postScan).toHaveBeenCalledTimes(1);
      expect(postScan.mock.calls[0]![0]).toBe(WEB3CHECKS_ETHEREUM_TX_SCAN_PATH);
      expect(postScan.mock.calls[0]![1]).toMatchObject({
        tx: {
          from: "0x1234567890123456789012345678901234567890",
          raw: "0xab",
        },
        chain: 1,
      });
    });

    it("routes solana kind to the solana path", async () => {
      const validFrom = bs58.encode(new Uint8Array(32).fill(1));
      const validRaw = bs58.encode(new Uint8Array([9]));
      const postScan = vi
        .fn()
        .mockResolvedValue(Right({ publicKeyId: "s", descriptor: "t" }));

      await dispatchTransactionCheckScanHandler(
        {
          kind: "solana",
          from: validFrom,
          rawTx: validRaw,
        },
        postScan,
      );

      expect(postScan).toHaveBeenCalledTimes(1);
      expect(postScan.mock.calls[0]![0]).toBe(WEB3CHECKS_SOLANA_TX_SCAN_PATH);
      expect(postScan.mock.calls[0]![1]).toEqual({
        tx: { from: validFrom, raw: validRaw },
      });
    });
  });

  describe("validation failure propagation", () => {
    it("returns Left and does not call postScan when ethereum validation fails", async () => {
      const postScan = vi.fn();

      const result = await dispatchTransactionCheckScanHandler(
        {
          kind: "ethereum",
          chainId: 1,
          from: "not-hex",
          rawTx: "0xab",
        },
        postScan,
      );

      expect(result.isLeft()).toBe(true);
      expect(postScan).not.toHaveBeenCalled();
    });

    it("returns Left and does not call postScan when solana validation fails", async () => {
      const postScan = vi.fn();

      const result = await dispatchTransactionCheckScanHandler(
        {
          kind: "solana",
          from: "!!!",
          rawTx: bs58.encode(new Uint8Array([1])),
        },
        postScan,
      );

      expect(result.isLeft()).toBe(true);
      expect(postScan).not.toHaveBeenCalled();
    });
  });
});
