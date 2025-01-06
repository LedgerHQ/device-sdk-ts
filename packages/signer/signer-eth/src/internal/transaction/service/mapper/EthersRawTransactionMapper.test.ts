import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { getBytes, Transaction } from "ethers";

import { EthersRawTransactionMapper } from "./EthersRawTransactionMapper";

describe("RawTransactionMapper", () => {
  const mapper = new EthersRawTransactionMapper();

  it("should return Nothing when empty raw transaction", () => {
    // GIVEN
    const transaction = new Uint8Array(0);

    // WHEN
    const result = mapper.map(transaction);

    // THEN
    expect(result.isNothing()).toBeTruthy();
  });

  it("should return Nothing when invalid raw transaction", () => {
    // GIVEN
    const transaction = new Uint8Array(1);

    // WHEN
    const result = mapper.map(transaction);

    // THEN
    expect(result.isNothing()).toBeTruthy();
  });

  it("should return a TransactionMapperResult", () => {
    // GIVEN
    const transaction = hexaStringToBuffer(
      Transaction.from({
        chainId: 1,
        to: "0x1234567890123456789012345678901234567890",
        data: "0x123456",
      }).unsignedSerialized,
    )!;

    // WHEN
    const result = mapper.map(transaction);

    // THEN
    expect(result.isJust()).toBeTruthy();
    expect(result.extract()?.serializedTransaction).toEqual(
      getBytes(transaction),
    );
    expect(result.extract()?.subset).toEqual({
      chainId: 1,
      to: "0x1234567890123456789012345678901234567890",
      data: "0x123456",
    });
    expect(result.extract()?.type).toEqual(2);
  });

  it("should return a TransactionMapperResult with undefined to", () => {
    // GIVEN
    const transaction = hexaStringToBuffer(
      Transaction.from({
        chainId: 1,
        data: "0x123456",
      }).unsignedSerialized,
    )!;

    // WHEN
    const result = mapper.map(transaction);

    // THEN
    expect(result.isJust()).toBeTruthy();
    expect(result.extract()?.serializedTransaction).toEqual(
      getBytes(transaction),
    );
    expect(result.extract()?.subset).toEqual({
      chainId: 1,
      to: undefined,
      data: "0x123456",
    });
    expect(result.extract()?.type).toEqual(2);
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
    const result = mapper.map(transaction);

    // THEN
    expect(result.isJust()).toBeTruthy();
    expect(result.extract()?.serializedTransaction).toEqual(
      getBytes(transaction),
    );
    expect(result.extract()?.subset).toEqual({
      chainId: 1,
      to: "0x1234567890123456789012345678901234567890",
      data: "0x",
    });
    expect(result.extract()?.type).toEqual(2);
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
    const result = mapper.map(transaction);

    // THEN
    expect(result.isJust()).toBeTruthy();
    expect(result.extract()?.serializedTransaction).toEqual(
      getBytes(transaction),
    );
    expect(result.extract()?.subset).toEqual({
      chainId: 1,
      to: "0x1234567890123456789012345678901234567890",
      data: "0x123456",
    });
    expect(result.extract()?.type).toEqual(1);
  });
});
