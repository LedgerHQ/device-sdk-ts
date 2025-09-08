import { type TransactionSubset } from "@ledgerhq/context-module";
import { Left, Right } from "purify-ts";

import { type TransactionType } from "@api/model/TransactionType";
import { type TransactionMapperResult } from "@internal/transaction/service/mapper/model/TransactionMapperResult";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

import {
  ParseTransactionTask,
  type ParseTransactionTaskArgs,
} from "./ParseTransactionTask";

describe("ParseTransactionTask", () => {
  const mockMapper = {
    mapTransactionToSubset: vi.fn(),
  };

  let defaultArgs: ParseTransactionTaskArgs;
  let mockTransaction: Uint8Array;
  let mockMapperResult: TransactionMapperResult;

  beforeEach(() => {
    vi.resetAllMocks();

    mockTransaction = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

    mockMapperResult = {
      subset: {
        chainId: 1,
        to: "0x1234567890123456789012345678901234567890",
        data: "0x1234567890",
        selector: "0x12345678",
        value: 1000n,
      },
      serializedTransaction: new Uint8Array([0x05, 0x06, 0x07, 0x08]),
      type: 2 as TransactionType,
    };

    defaultArgs = {
      mapper: mockMapper as unknown as TransactionMapperService,
      transaction: mockTransaction,
    };
  });

  describe("run", () => {
    it("should successfully parse transaction and return subset and type", () => {
      // GIVEN
      mockMapper.mapTransactionToSubset.mockReturnValue(
        Right(mockMapperResult),
      );

      // WHEN
      const result = new ParseTransactionTask(defaultArgs).run();

      // THEN
      expect(mockMapper.mapTransactionToSubset).toHaveBeenCalledWith(
        mockTransaction,
      );
      expect(result).toEqual({
        subset: mockMapperResult.subset,
        type: mockMapperResult.type,
      });
    });

    it("should pass through the transaction data to the mapper", () => {
      // GIVEN
      const customTransaction = new Uint8Array([0x0a, 0x0b, 0x0c, 0x0d, 0x0e]);
      const customArgs = {
        ...defaultArgs,
        transaction: customTransaction,
      };
      mockMapper.mapTransactionToSubset.mockReturnValue(
        Right(mockMapperResult),
      );

      // WHEN
      new ParseTransactionTask(customArgs).run();

      // THEN
      expect(mockMapper.mapTransactionToSubset).toHaveBeenCalledWith(
        customTransaction,
      );
    });

    it("should return correct subset structure", () => {
      // GIVEN
      const customSubset: TransactionSubset = {
        chainId: 42,
        to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        data: "0xdeadbeef",
        selector: "0xdeadbeef",
        value: 2000n,
        from: "0x9876543210987654321098765432109876543210",
      };
      const customMapperResult: TransactionMapperResult = {
        ...mockMapperResult,
        subset: customSubset,
        type: 1 as TransactionType,
      };
      mockMapper.mapTransactionToSubset.mockReturnValue(
        Right(customMapperResult),
      );

      // WHEN
      const result = new ParseTransactionTask(defaultArgs).run();

      // THEN
      expect(result.subset).toEqual(customSubset);
      expect(result.type).toEqual(1);
    });

    it("should throw when mapper returns Left (error)", () => {
      // GIVEN
      const mappingError = new Error("Invalid transaction format");
      mockMapper.mapTransactionToSubset.mockReturnValue(Left(mappingError));

      // WHEN / THEN
      expect(() => new ParseTransactionTask(defaultArgs).run()).toThrow();
    });

    it("should throw when mapper returns Left with specific error message", () => {
      // GIVEN
      const specificError = new Error(
        "Pre-EIP-155 transactions are not supported",
      );
      mockMapper.mapTransactionToSubset.mockReturnValue(Left(specificError));

      // WHEN / THEN
      expect(() => new ParseTransactionTask(defaultArgs).run()).toThrow();
    });
  });

  describe("constructor", () => {
    it("should store args correctly", () => {
      // GIVEN / WHEN
      const task = new ParseTransactionTask(defaultArgs);

      // THEN
      expect(task).toBeInstanceOf(ParseTransactionTask);
      // We can't directly test private properties, but we can verify behavior
      mockMapper.mapTransactionToSubset.mockReturnValue(
        Right(mockMapperResult),
      );
      const result = task.run();
      expect(result).toBeDefined();
    });
  });
});
