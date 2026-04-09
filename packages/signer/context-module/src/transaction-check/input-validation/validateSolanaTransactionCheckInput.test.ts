import bs58 from "bs58";
import { Right } from "purify-ts";

import { validateSolanaTransactionCheckInput } from "@/transaction-check/input-validation/validateSolanaTransactionCheckInput";

describe("validateSolanaTransactionCheckInput", () => {
  const from = bs58.encode(new Uint8Array(32).fill(3));
  const rawTx = bs58.encode(new Uint8Array([9, 8, 7]));

  it("accepts valid base58 from and raw (tx.from / tx.raw)", () => {
    const result = validateSolanaTransactionCheckInput({ from, rawTx });
    expect(result).toEqual(
      Right({
        from,
        rawTx,
        chain: undefined,
        domain: undefined,
        block: undefined,
      }),
    );
  });

  it("passes chain 1 / 2 / 3 (mainnet-beta / devnet / testnet)", () => {
    expect(
      validateSolanaTransactionCheckInput({ from, rawTx, chain: 1 }),
    ).toEqual(
      Right({
        from,
        rawTx,
        chain: 1,
        domain: undefined,
        block: undefined,
      }),
    );
    expect(
      validateSolanaTransactionCheckInput({ from, rawTx, chain: 2 }),
    ).toEqual(
      Right({
        from,
        rawTx,
        chain: 2,
        domain: undefined,
        block: undefined,
      }),
    );
  });

  it("rejects chain outside 1–3", () => {
    const result = validateSolanaTransactionCheckInput({
      from,
      rawTx,
      chain: 99,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("passes domain when non-empty", () => {
    const result = validateSolanaTransactionCheckInput({
      from,
      rawTx,
      domain: " https://example-dapp.com ",
    });
    expect(result).toEqual(
      Right({
        from,
        rawTx,
        chain: undefined,
        domain: "https://example-dapp.com",
        block: undefined,
      }),
    );
  });

  it("passes block when integer (slot)", () => {
    const result = validateSolanaTransactionCheckInput({
      from,
      rawTx,
      block: 284578192,
    });
    expect(result).toEqual(
      Right({
        from,
        rawTx,
        chain: undefined,
        domain: undefined,
        block: 284578192,
      }),
    );
  });

  it("rejects non-integer block", () => {
    const result = validateSolanaTransactionCheckInput({
      from,
      rawTx,
      block: 1.5,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects invalid base58 from", () => {
    const result = validateSolanaTransactionCheckInput({
      from: "!!!",
      rawTx,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects from with wrong decoded length", () => {
    const shortKey = bs58.encode(new Uint8Array(31).fill(1));
    const result = validateSolanaTransactionCheckInput({
      from: shortKey,
      rawTx,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects invalid base58 raw", () => {
    const result = validateSolanaTransactionCheckInput({
      from,
      rawTx: "@@@",
    });
    expect(result.isLeft()).toBe(true);
  });
});
