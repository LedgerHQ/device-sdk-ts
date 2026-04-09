import { describe, expect, it } from "vitest";

import { type ValidatedEthereumTransactionCheckInput } from "@/transaction-check/input-validation/validateEthereumTransactionCheckInput";

import { ethereumTransactionCheckScanHandler } from "./ethereumTransactionCheckScanHandler";
import { WEB3CHECKS_ETHEREUM_TX_SCAN_PATH } from "./web3CheckScanPaths";

describe("ethereumTransactionCheckScanHandler", () => {
  const validated: ValidatedEthereumTransactionCheckInput = {
    from: "0x1234567890123456789012345678901234567890",
    rawTx: "0xabcdef",
    chainId: 1,
    domain: undefined,
    block: undefined,
  };

  it("returns the ethereum path and normalized body", () => {
    const result = ethereumTransactionCheckScanHandler(validated);

    expect(result).toEqual({
      path: WEB3CHECKS_ETHEREUM_TX_SCAN_PATH,
      body: {
        tx: { from: validated.from, raw: validated.rawTx },
        chain: validated.chainId,
      },
    });
  });

  it("includes domain and block when provided", () => {
    const result = ethereumTransactionCheckScanHandler({
      ...validated,
      domain: "https://app.example.com",
      block: 21_680_884,
    });

    expect(result).toEqual({
      path: WEB3CHECKS_ETHEREUM_TX_SCAN_PATH,
      body: {
        tx: { from: validated.from, raw: validated.rawTx },
        chain: validated.chainId,
        domain: "https://app.example.com",
        block: 21_680_884,
      },
    });
  });

  it("omits domain when undefined", () => {
    const result = ethereumTransactionCheckScanHandler(validated);

    expect(result.body.domain).toBeUndefined();
  });
});
