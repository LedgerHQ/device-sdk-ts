import { Transaction as EthersV6Transaction } from "ethers-v6";
import { Just } from "purify-ts";

import { Transaction } from "@api/index";

import { EthersV6TransactionMapper } from "./EthersV6TransactionMapper";

describe("EthersV6TransactionMapper", () => {
  let mapper: EthersV6TransactionMapper;

  beforeEach(() => {
    mapper = new EthersV6TransactionMapper();
  });

  describe("map", () => {
    it("should return the correct TransactionSubset", () => {
      // GIVEN
      const transaction = new EthersV6Transaction();
      transaction.chainId = 1n;
      transaction.nonce = 0;
      transaction.data = "0x";
      const serializedTransaction = new Uint8Array([
        2, 201, 1, 128, 128, 128, 128, 128, 128, 128, 192,
      ]);

      // WHEN
      const result = mapper.map(transaction);

      // THEN
      expect(result).toEqual(
        Just({
          subset: {
            chainId: 1,
            to: undefined,
            data: "0x",
          },
          serializedTransaction,
        }),
      );
    });

    it("should return the correct TransactionSubset with to attribute", () => {
      // GIVEN
      const transaction = new EthersV6Transaction();
      transaction.chainId = 1n;
      transaction.nonce = 0;
      transaction.data = "0x";
      transaction.to = "0x0123456789abcdef0123456789abcdef01234567";
      const serializedTransaction = new Uint8Array([
        0x02, 0xdd, 0x01, 0x80, 0x80, 0x80, 0x80, 0x94, 0x01, 0x23, 0x45, 0x67,
        0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
        0x01, 0x23, 0x45, 0x67, 0x80, 0x80, 0xc0,
      ]);

      // WHEN
      const result = mapper.map(transaction);

      // THEN
      expect(result).toEqual(
        Just({
          subset: {
            chainId: 1,
            to: "0x0123456789abcDEF0123456789abCDef01234567",
            data: "0x",
          },
          serializedTransaction,
        }),
      );
    });

    it("should return the correct TransactionSubset with all attributes", () => {
      // GIVEN
      const transaction = new EthersV6Transaction();
      transaction.type = 0;
      transaction.to = "0x0123456789abcdef0123456789abcdef01234567";
      transaction.data = "0x";
      transaction.nonce = 0;
      transaction.gasLimit = 0n;
      transaction.gasPrice = 0n;
      transaction.value = 0n;
      transaction.chainId = 1n;
      const serializedTransaction = new Uint8Array([
        0xdd, 0x80, 0x80, 0x80, 0x94, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd,
        0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45,
        0x67, 0x80, 0x80, 0x01, 0x80, 0x80,
      ]);

      // WHEN
      const result = mapper.map(transaction);

      // THEN
      expect(result).toEqual(
        Just({
          subset: {
            chainId: 1,
            to: "0x0123456789abcDEF0123456789abCDef01234567",
            data: "0x",
          },
          serializedTransaction,
        }),
      );
    });

    it("should return Nothing when the transaction is not an EthersV6Transaction", () => {
      // GIVEN
      const transaction = {} as Transaction;

      // WHEN
      const result = mapper.map(transaction);

      // THEN
      expect(result.isNothing()).toBeTruthy();
    });
  });
});
