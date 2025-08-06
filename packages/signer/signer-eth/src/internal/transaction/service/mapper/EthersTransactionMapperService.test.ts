import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { getBytes, Transaction } from "ethers";

import { EthersTransactionMapperService } from "./EthersTransactionMapperService";

describe("RawTransactionMapper", () => {
  const mapper = new EthersTransactionMapperService();

  it("should return Nothing when empty raw transaction", () => {
    // GIVEN
    const transaction = new Uint8Array(0);

    // WHEN
    const result = mapper.mapTransactionToSubset(transaction);

    // THEN
    expect(result.isLeft()).toBeTruthy();
  });

  it("should return Nothing when invalid raw transaction", () => {
    // GIVEN
    const transaction = new Uint8Array(1);

    // WHEN
    const result = mapper.mapTransactionToSubset(transaction);

    // THEN
    expect(result.isLeft()).toBeTruthy();
  });

  it("should return a TransactionMapperResult", () => {
    // GIVEN
    const transaction = hexaStringToBuffer(
      Transaction.from({
        chainId: 1,
        to: "0x1234567890123456789012345678901234567890",
        data: "0x1234567890",
      }).unsignedSerialized,
    )!;

    // WHEN
    const result = mapper.mapTransactionToSubset(transaction);

    // THEN
    expect(result.isRight()).toBeTruthy();
    const { serializedTransaction, subset, type } = result.unsafeCoerce();
    expect(serializedTransaction).toEqual(getBytes(transaction));
    expect(subset).toEqual({
      chainId: 1,
      to: "0x1234567890123456789012345678901234567890",
      data: "0x1234567890",
      value: 0n,
      selector: "0x12345678",
    });
    expect(type).toEqual(2);
  });

  it("should return a TransactionMapperResult with undefined to", () => {
    // GIVEN
    const transaction = hexaStringToBuffer(
      Transaction.from({
        chainId: 1,
        data: "0x1234567890",
      }).unsignedSerialized,
    )!;

    // WHEN
    const result = mapper.mapTransactionToSubset(transaction);

    // THEN
    expect(result.isRight()).toBeTruthy();
    const { serializedTransaction, subset, type } = result.unsafeCoerce();
    expect(serializedTransaction).toEqual(getBytes(transaction));
    expect(subset).toEqual({
      chainId: 1,
      to: undefined,
      data: "0x1234567890",
      value: 0n,
      selector: "0x12345678",
    });
    expect(type).toEqual(2);
  });

  it("should return a TransactionMapperResult with empty data", () => {
    // GIVEN
    const transaction = hexaStringToBuffer(
      Transaction.from({
        chainId: 1,
        to: "0x1234567890123456789012345678901234567890",
      }).unsignedSerialized,
    )!;

    // WHEN
    const result = mapper.mapTransactionToSubset(transaction);

    // THEN
    expect(result.isRight()).toBeTruthy();
    const { serializedTransaction, subset, type } = result.unsafeCoerce();
    expect(serializedTransaction).toEqual(getBytes(transaction));
    expect(subset).toEqual({
      chainId: 1,
      to: "0x1234567890123456789012345678901234567890",
      data: "0x",
      value: 0n,
      selector: "0x",
    });
    expect(type).toEqual(2);
  });

  it("should return a TransactionMapperResult with a custom type", () => {
    // GIVEN
    const transaction = hexaStringToBuffer(
      Transaction.from({
        chainId: 1,
        to: "0x1234567890123456789012345678901234567890",
        data: "0x123456",
        type: 1,
      }).unsignedSerialized,
    )!;

    // WHEN
    const result = mapper.mapTransactionToSubset(transaction);

    // THEN
    expect(result.isRight()).toBeTruthy();
    const { serializedTransaction, subset, type } = result.unsafeCoerce();
    expect(serializedTransaction).toEqual(getBytes(transaction));
    expect(subset).toEqual({
      chainId: 1,
      to: "0x1234567890123456789012345678901234567890",
      data: "0x123456",
      value: 0n,
      selector: "0x123456",
    });
    expect(type).toEqual(1);
  });

  it("should return a Left when the chainId is 0", () => {
    // GIVEN
    const transaction = hexaStringToBuffer(
      Transaction.from({
        chainId: 0,
      }).unsignedSerialized,
    )!;

    // WHEN
    const result = mapper.mapTransactionToSubset(transaction);

    // THEN
    expect(result.isLeft()).toBeTruthy();
    expect(result.extract()).toEqual(
      new Error("Pre-EIP-155 transactions are not supported"),
    );
  });
});
