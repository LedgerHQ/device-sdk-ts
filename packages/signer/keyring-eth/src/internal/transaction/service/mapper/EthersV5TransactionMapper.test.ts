import {
  BigNumber as EthersV5BigNumber,
  Transaction as EthersV5Transaction,
} from "ethers-v5";
import { Just } from "purify-ts";

import { Transaction } from "@api/index";

import { EthersV5TransactionMapper } from "./EthersV5TransactionMapper";
import { TransactionMapper } from "./TransactionMapper";

describe("EthersV5TransactionMapper", () => {
  let mapper: TransactionMapper;

  beforeEach(() => {
    mapper = new EthersV5TransactionMapper();
  });

  describe("map", () => {
    it("should return the correct TransactionSubset", () => {
      // GIVEN
      const transaction: EthersV5Transaction = {
        chainId: 1,
        nonce: 0,
        gasLimit: EthersV5BigNumber.from(0),
        value: EthersV5BigNumber.from(0),
        data: "0x",
      };
      const serializedTransaction = new Uint8Array([
        0xc9, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01, 0x80, 0x80,
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
          type: 0,
        }),
      );
    });

    it("should return the correct TransactionSubset with to attribute", () => {
      // GIVEN
      const transaction: EthersV5Transaction = {
        chainId: 1,
        nonce: 0,
        gasLimit: EthersV5BigNumber.from(0),
        value: EthersV5BigNumber.from(0),
        data: "0x",
        to: "0x",
      };
      const serializedTransaction = new Uint8Array([
        0xc9, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01, 0x80, 0x80,
      ]);

      // WHEN
      const result = mapper.map(transaction);

      // THEN
      expect(result).toEqual(
        Just({
          subset: {
            chainId: 1,
            to: "0x",
            data: "0x",
          },
          serializedTransaction,
          type: 0,
        }),
      );
    });

    it("should return the correct TransactionSubset with all attributes", () => {
      // GIVEN
      const transaction: EthersV5Transaction = {
        chainId: 1,
        nonce: 0,
        gasLimit: EthersV5BigNumber.from(0),
        gasPrice: EthersV5BigNumber.from(0),
        value: EthersV5BigNumber.from(0),
        data: "0x",
        from: "0x",
        r: "0x",
        s: "0x",
        v: 0,
        type: 1,
        maxFeePerGas: EthersV5BigNumber.from(0),
        maxPriorityFeePerGas: EthersV5BigNumber.from(0),
      };
      const serializedTransaction = new Uint8Array([
        0xc9, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01, 0x80, 0x80,
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
          type: 1,
        }),
      );
    });

    it("should return Nothing when the transaction is not an EthersV5Transaction", () => {
      // GIVEN
      const transaction = {} as Transaction;

      // WHEN
      const result = mapper.map(transaction);

      // THEN
      expect(result.isNothing()).toBeTruthy();
    });
  });
});
