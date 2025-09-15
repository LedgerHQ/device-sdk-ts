import {
  ClearSignContextReferenceType,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type DataPathElement,
  DataPathElementType,
  DataPathLeafType,
  type GenericPath,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import { Left, Right } from "purify-ts";

import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import {
  ParseNestedTransactionTask,
  type ParseNestedTransactionTaskArgs,
} from "./ParseNestedTransactionTask";

describe("ParseNestedTransactionTask", () => {
  const transactionParserMock = {
    extractValue: vi.fn(),
  };

  const defaultSubset: TransactionSubset = {
    chainId: 1,
    to: "0x1234567890123456789012345678901234567890",
    data: "0x060708090A",
    selector: "0x06070809",
    value: 0n,
  };

  const mockValuePath: DataPathElement[] = [
    {
      type: DataPathElementType.TUPLE,
      offset: 1,
    },
    {
      type: DataPathElementType.TUPLE,
      offset: 2,
    },
    {
      type: DataPathElementType.LEAF,
      leafType: DataPathLeafType.STATIC_LEAF,
    },
  ];

  const defaultContext: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION> =
    {
      type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
      payload: "test payload",
      reference: {
        type: ClearSignContextReferenceType.CALLDATA,
        valuePath: mockValuePath,
        selector: mockValuePath,
        callee: mockValuePath,
        amount: mockValuePath,
      },
    };

  let defaultArgs: ParseNestedTransactionTaskArgs;

  beforeEach(() => {
    vi.resetAllMocks();
    defaultArgs = {
      parser: transactionParserMock as unknown as TransactionParserService,
      subset: defaultSubset,
      context: defaultContext,
    };
  });

  describe("run", () => {
    describe("error cases", () => {
      it("should throw error when context has no reference", () => {
        // GIVEN
        const contextWithoutReference: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION> =
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
          };
        const args = { ...defaultArgs, context: contextWithoutReference };

        // WHEN & THEN
        expect(() => new ParseNestedTransactionTask(args).run()).toThrow(
          "Invalid reference for nested call data. Expected a reference with type CALLDATA and a value path.",
        );
      });

      it("should throw error when reference type is not CALLDATA", () => {
        // GIVEN
        const contextWithWrongType: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION> =
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.TOKEN,
              valuePath: mockValuePath,
            },
          };
        const args = { ...defaultArgs, context: contextWithWrongType };

        // WHEN & THEN
        expect(() => new ParseNestedTransactionTask(args).run()).toThrow(
          "Invalid reference for nested call data. Expected a reference with type CALLDATA and a value path.",
        );
      });

      it("should throw error when reference has no valuePath", () => {
        // GIVEN
        const contextWithoutValuePath: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION> =
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.CALLDATA,
              valuePath: undefined as unknown as GenericPath,
              selector: undefined as unknown as GenericPath,
              callee: undefined as unknown as GenericPath,
              amount: undefined as unknown as GenericPath,
              spender: undefined as unknown as GenericPath,
              chainId: undefined as unknown as GenericPath,
            },
          };
        const args = { ...defaultArgs, context: contextWithoutValuePath };

        // WHEN & THEN
        expect(() => new ParseNestedTransactionTask(args).run()).toThrow(
          "Invalid reference for nested call data. Expected a reference with type CALLDATA and a value path.",
        );
      });

      it("should throw error when parser returns error", () => {
        // GIVEN
        transactionParserMock.extractValue.mockReturnValue(
          Left(new Error("Parser error")),
        );
        const args = { ...defaultArgs };

        // WHEN & THEN
        expect(() => new ParseNestedTransactionTask(args).run()).toThrow(
          "Parser error",
        );
      });
    });

    describe("success cases", () => {
      it("should return new subset with extracted data when all fields are provided", () => {
        // GIVEN
        transactionParserMock.extractValue.mockReturnValueOnce(
          Right([new Uint8Array([0x01, 0x02, 0x03, 0x04])]),
        );
        transactionParserMock.extractValue.mockReturnValueOnce(
          Right([new Uint8Array([0x02, 0x03, 0x04, 0x05])]),
        );
        transactionParserMock.extractValue.mockReturnValueOnce(
          Right([new Uint8Array([0x03, 0x04, 0x05, 0x06])]),
        );

        const context: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION> =
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.CALLDATA,
              valuePath: mockValuePath,
              selector: mockValuePath,
              callee: mockValuePath,
              amount: mockValuePath,
            },
          };

        const args = { ...defaultArgs, context };

        // WHEN
        const result = new ParseNestedTransactionTask(args).run();

        // THEN
        expect(transactionParserMock.extractValue).toHaveBeenCalledWith(
          defaultSubset,
          mockValuePath,
        );
        expect(result).toEqual({
          subsets: [
            {
              data: "0x01020304",
              chainId: 1,
              selector: "0x03040506",
              to: "0x02030405",
            },
          ],
        });
      });

      it("should use data.slice(0, 10) as selector when selector is not provided", () => {
        // GIVEN
        transactionParserMock.extractValue.mockReturnValueOnce(
          Right([
            new Uint8Array([
              0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
            ]),
          ]),
        );
        transactionParserMock.extractValue.mockReturnValueOnce(
          Right([new Uint8Array([0x02, 0x03, 0x04, 0x05])]),
        );
        transactionParserMock.extractValue.mockReturnValueOnce(
          Left(new Error("Parser error")),
        );
        transactionParserMock.extractValue.mockReturnValueOnce(
          Right([new Uint8Array([0x03, 0x04, 0x05, 0x06])]),
        );

        const context: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION> =
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.CALLDATA,
              valuePath: mockValuePath,
              callee: mockValuePath,
              amount: mockValuePath,
            },
          };

        const args = { ...defaultArgs, context };

        // WHEN
        const result = new ParseNestedTransactionTask(args).run();

        // THEN
        expect(result.subsets[0]).toEqual({
          data: "0x0102030405060708090a",
          chainId: 1,
          selector: "0x01020304",
          to: "0x02030405",
        });
      });

      it("should use defaults values when no value are returned from parser", () => {
        // GIVEN
        transactionParserMock.extractValue.mockReturnValueOnce(
          Right([new Uint8Array([0x01, 0x02, 0x03, 0x04])]),
        );
        transactionParserMock.extractValue.mockReturnValue(Right([]));

        const context: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION> =
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.CALLDATA,
              valuePath: mockValuePath,
              selector: mockValuePath,
              callee: mockValuePath,
              amount: mockValuePath,
            },
          };

        const args = { ...defaultArgs, context };

        // WHEN
        const result = new ParseNestedTransactionTask(args).run();

        // THEN
        expect(result.subsets[0]).toEqual({
          data: "0x01020304",
          chainId: 1,
          selector: "0x01020304",
          to: "0x1234567890123456789012345678901234567890",
        });
      });

      it("should preserve chainId from original subset", () => {
        // GIVEN
        transactionParserMock.extractValue.mockReturnValue(
          Right([new Uint8Array([0x01, 0x02, 0x03, 0x04])]),
        );

        const subsetWithDifferentChainId: TransactionSubset = {
          ...defaultSubset,
          chainId: 137, // Polygon
        };

        const args = { ...defaultArgs, subset: subsetWithDifferentChainId };

        // WHEN
        const result = new ParseNestedTransactionTask(args).run();

        // THEN
        expect(result.subsets[0]?.chainId).toBe(137);
      });
    });
  });
});
