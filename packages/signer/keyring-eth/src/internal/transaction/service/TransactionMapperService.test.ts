import {
  BigNumber as EthersV5BigNumber,
  Transaction as EthersV5Transaction,
} from "ethers-v5";
import { Transaction as EthersV6Transaction } from "ethers-v6";
import { Right } from "purify-ts";

import { TransactionMapperService } from "./TransactionMapperService";

describe("TransactionMapperService", () => {
  let service: TransactionMapperService;

  beforeEach(() => {
    service = new TransactionMapperService();
  });

  describe("mapTransactionToContext", () => {
    describe("EthersV5Transaction", () => {
      it("should return the correct TransactionSubset", () => {
        // GIVEN
        const transaction: EthersV5Transaction = {
          chainId: 1,
          nonce: 0,
          gasLimit: EthersV5BigNumber.from(0),
          value: EthersV5BigNumber.from(0),
          data: "0x",
        };

        // WHEN
        const result = service.mapTransactionToSubset(transaction);

        // THEN
        expect(result).toEqual(
          Right({
            chainId: 1,
            to: undefined,
            data: "0x",
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

        // WHEN
        const result = service.mapTransactionToSubset(transaction);

        // THEN
        expect(result).toEqual(
          Right({
            chainId: 1,
            to: "0x",
            data: "0x",
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
          type: 0,
          maxFeePerGas: EthersV5BigNumber.from(0),
          maxPriorityFeePerGas: EthersV5BigNumber.from(0),
        };

        // WHEN
        const result = service.mapTransactionToSubset(transaction);

        // THEN
        expect(result).toEqual(
          Right({
            chainId: 1,
            to: undefined,
            data: "0x",
          }),
        );
      });
    });

    describe("EthersV6Transaction", () => {
      it("should return the correct TransactionSubset", () => {
        // GIVEN
        const transaction = new EthersV6Transaction();
        transaction.chainId = 1n;
        transaction.nonce = 0;
        transaction.data = "0x";

        // WHEN
        const result = service.mapTransactionToSubset(transaction);

        // THEN
        expect(result).toEqual(
          Right({
            chainId: 1,
            to: undefined,
            data: "0x",
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

        // WHEN
        const result = service.mapTransactionToSubset(transaction);

        // THEN
        expect(result).toEqual(
          Right({
            chainId: 1,
            to: "0x0123456789abcDEF0123456789abCDef01234567",
            data: "0x",
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
        transaction.maxPriorityFeePerGas = 0n;
        transaction.maxFeePerGas = 0n;
        transaction.value = 0n;
        transaction.chainId = 1n;
        transaction.accessList = [];
        transaction.maxFeePerBlobGas = 0n;
        transaction.blobs = [];

        // WHEN
        const result = service.mapTransactionToSubset(transaction);

        // THEN
        expect(result).toEqual(
          Right({
            chainId: 1,
            to: "0x0123456789abcDEF0123456789abCDef01234567",
            data: "0x",
          }),
        );
      });
    });

    describe("Unsupported transaction type", () => {
      it("should return an error", () => {
        // GIVEN
        const transaction = {} as EthersV5Transaction;

        // WHEN
        const result = service.mapTransactionToSubset(transaction);

        // THEN
        expect(result.isLeft()).toBeTruthy();
        expect(result.extract()).toEqual(
          new Error("Unsupported transaction type"),
        );
      });
    });
  });
});
