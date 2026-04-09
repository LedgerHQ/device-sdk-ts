import { Right } from "purify-ts";

import { validateEthereumTransactionCheckInput } from "@/transaction-check/input-validation/validateEthereumTransactionCheckInput";

describe("validateEthereumTransactionCheckInput", () => {
  it("accepts valid hex from and rawTx", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xabcdef",
      chainId: 1,
    });
    expect(result).toEqual(
      Right({
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
        domain: undefined,
        block: undefined,
      }),
    );
  });

  it("rejects invalid from", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "not-hex",
      rawTx: "0xab",
      chainId: 1,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects empty from 0x", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x",
      rawTx: "0xab",
      chainId: 1,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects invalid rawTx hex", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "zz",
      chainId: 1,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("passes through chainId", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xab",
      chainId: 137,
    });
    expect(result.extract()).toMatchObject({ chainId: 137 });
  });

  it("rejects non-integer chainId", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xab",
      chainId: 1.5,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects zero chainId", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xab",
      chainId: 0,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects negative chainId", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xab",
      chainId: -1,
    });
    expect(result.isLeft()).toBe(true);
  });

  it("trims domain and passes it through", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xab",
      chainId: 1,
      domain: "  https://app.example.com  ",
    });
    expect(result.extract()).toMatchObject({
      domain: "https://app.example.com",
    });
  });

  it("normalizes empty or whitespace-only domain to undefined", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xab",
      chainId: 1,
      domain: "   \t  ",
    });
    expect(result.extract()).toMatchObject({ domain: undefined });
  });

  it("passes through block when provided", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xab",
      chainId: 1,
      block: 21_680_884,
    });
    expect(result.extract()).toMatchObject({ block: 21_680_884 });
  });

  it("rejects non-integer block", () => {
    const result = validateEthereumTransactionCheckInput({
      from: "0x1234567890123456789012345678901234567890",
      rawTx: "0xab",
      chainId: 1,
      block: 1.5,
    });
    expect(result.isLeft()).toBe(true);
  });
});
