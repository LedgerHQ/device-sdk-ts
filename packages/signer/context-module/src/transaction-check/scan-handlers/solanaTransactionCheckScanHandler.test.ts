import bs58 from "bs58";
import { describe, expect, it } from "vitest";

import { type ValidatedSolanaTransactionCheckInput } from "@/transaction-check/input-validation/validateSolanaTransactionCheckInput";

import { solanaTransactionCheckScanHandler } from "./solanaTransactionCheckScanHandler";
import { WEB3CHECKS_SOLANA_TX_SCAN_PATH } from "./web3CheckScanPaths";

describe("solanaTransactionCheckScanHandler", () => {
  const validFrom = bs58.encode(new Uint8Array(32).fill(2));
  const validRaw = bs58.encode(new Uint8Array([1, 2, 3, 4]));

  const validated: ValidatedSolanaTransactionCheckInput = {
    from: validFrom,
    rawTx: validRaw,
    chain: undefined,
    domain: undefined,
    block: undefined,
  };

  it("returns the solana path and body", () => {
    const result = solanaTransactionCheckScanHandler(validated);

    expect(result).toEqual({
      path: WEB3CHECKS_SOLANA_TX_SCAN_PATH,
      body: {
        tx: { from: validFrom, raw: validRaw },
      },
    });
  });

  it("includes chain, domain, and block when present in validated input", () => {
    const result = solanaTransactionCheckScanHandler({
      ...validated,
      chain: 1,
      domain: "https://dapp.example",
      block: 284_578_192,
    });

    expect(result).toEqual({
      path: WEB3CHECKS_SOLANA_TX_SCAN_PATH,
      body: {
        tx: { from: validFrom, raw: validRaw },
        chain: 1,
        domain: "https://dapp.example",
        block: 284_578_192,
      },
    });
  });
});
