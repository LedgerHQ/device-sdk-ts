import {
  type ClearSignContextReference,
  ClearSignContextReferenceType,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type GenericPath,
  type TransactionFieldContext,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import {
  BuildSubcontextsTask,
  type BuildSubcontextsTaskArgs,
} from "./BuildSubcontextsTask";

describe("BuildSubcontextsTask", () => {
  const contextModuleMock = {
    getContext: vi.fn(),
  };
  const transactionParserMock = {
    extractValue: vi.fn(),
  };
  const apiMock = makeDeviceActionInternalApiMock();

  let defaultArgs: BuildSubcontextsTaskArgs;

  beforeEach(() => {
    vi.resetAllMocks();
    defaultArgs = {
      context: {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "test payload",
      },
      contextOptional: [],
      transactionParser:
        transactionParserMock as unknown as TransactionParserService,
      subset: {
        chainId: 1,
        data: "0x",
        selector: "0x",
        to: "0x",
        value: BigInt(0),
      },
      contextModule: contextModuleMock as unknown as ContextModule,
    };
  });

  describe("when context type is a simple type", () => {
    const simpleTypes: ClearSignContextSuccess["type"][] = [
      ClearSignContextType.TRANSACTION_INFO,
      ClearSignContextType.WEB3_CHECK,
      ClearSignContextType.PLUGIN,
      ClearSignContextType.EXTERNAL_PLUGIN,
      ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
    ];

    it.each(simpleTypes)(
      "should return context with empty subcontextCallbacks for %s",
      (type) => {
        // GIVEN
        const context: ClearSignContextSuccess = {
          type,
          payload: "test payload",
        } as ClearSignContextSuccess;
        const args = { ...defaultArgs, context };

        // WHEN
        const result = new BuildSubcontextsTask(apiMock, args).run();

        // THEN
        expect(result.subcontextCallbacks).toHaveLength(0);
      },
    );
  });

  describe("when context has a direct value reference", () => {
    it("should create a callback to get context with the direct value", async () => {
      // GIVEN
      const context: ClearSignContextSuccess = {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "test payload",
        reference: {
          type: ClearSignContextReferenceType.TOKEN,
          value: "0x1234567890123456789012345678901234567890",
        },
      };
      const args = { ...defaultArgs, context };
      const expectedContext: TransactionFieldContext = {
        type: ClearSignContextType.TOKEN,
        chainId: 1,
        address: "0x1234567890123456789012345678901234567890",
      };

      // WHEN
      const result = new BuildSubcontextsTask(apiMock, args).run();

      // THEN
      expect(result.subcontextCallbacks).toHaveLength(1);

      // Verify the callback calls getContext with correct parameters
      const callback = result.subcontextCallbacks[0]!;
      await callback();
      expect(contextModuleMock.getContext).toHaveBeenCalledWith(
        expectedContext,
      );
    });

    it("should handle undefined value in reference", () => {
      // GIVEN
      const context: ClearSignContextSuccess = {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "test payload",
        reference: undefined as unknown as ClearSignContextReference,
      };
      const args = { ...defaultArgs, context };

      // WHEN
      const result = new BuildSubcontextsTask(apiMock, args).run();

      // THEN
      expect(result.subcontextCallbacks).toHaveLength(0);
    });
  });

  describe("when context has a valuePath reference", () => {
    beforeEach(() => {
      apiMock.sendCommand.mockResolvedValue(
        CommandResultFactory({ data: { challenge: "test-challenge" } }),
      );
    });

    describe("when extractValue returns Left (error)", () => {
      it("should return context with empty subcontextCallbacks", () => {
        // GIVEN
        const context: ClearSignContextSuccess = {
          type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          payload: "test payload",
          reference: {
            type: ClearSignContextReferenceType.TOKEN,
            valuePath: [{ type: "SLICE", start: 0, end: 20 }],
          },
        };
        const args = { ...defaultArgs, context };
        transactionParserMock.extractValue.mockReturnValue(
          Left(new Error("Extraction failed")),
        );

        // WHEN
        const result = new BuildSubcontextsTask(apiMock, args).run();

        // THEN
        expect(result.subcontextCallbacks).toHaveLength(0);
      });
    });

    describe("when extractValue returns Right with values", () => {
      describe("for ENUM type", () => {
        it("should create callbacks for matching enum contexts", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.ENUM,
              id: 1,
              valuePath: [{ type: "TUPLE", offset: 0 }],
            },
          };
          // enum with the same id but different value
          const enumContext1: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 1,
            value: 1,
            payload: "enum context 1",
          };
          // enum to select, id and value match
          const enumContext2: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 1,
            value: 2,
            payload: "enum context 2",
          };
          // other enum context with different id
          const enumContext3: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 2,
            value: 2,
            payload: "enum context 3",
          };
          const args = {
            ...defaultArgs,
            context,
            contextOptional: [enumContext1, enumContext2, enumContext3],
          };
          const extractedValues = [new Uint8Array([0x01, 0x02])]; // Last byte is 2
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(1);
          const callback = result.subcontextCallbacks[0]!;
          const callbackResult = await callback();
          expect(callbackResult).toEqual(enumContext2);
        });

        it("should create callbacks for matching enum contexts with two values", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.ENUM,
              id: 1,
              valuePath: [{ type: "TUPLE", offset: 0 }],
            },
          };
          // enum to select, id and value match
          const enumContext1: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 1,
            value: 1,
            payload: "enum context 1",
          };
          // enum to select, id and value match
          const enumContext2: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 1,
            value: 2,
            payload: "enum context 2",
          };
          // other enum context with different id
          const enumContext3: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 2,
            value: 2,
            payload: "enum context 3",
          };
          const args = {
            ...defaultArgs,
            context,
            contextOptional: [enumContext1, enumContext2, enumContext3],
          };
          const extractedValues = [
            new Uint8Array([0x01, 0x02]),
            new Uint8Array([0x03, 0x02, 0x01]),
          ]; // Last byte is 2
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(2);
          const callback1 = result.subcontextCallbacks[0]!;
          const callback2 = result.subcontextCallbacks[1]!;
          const callbackResult1 = await callback1();
          const callbackResult2 = await callback2();
          expect(callbackResult1).toEqual(enumContext2);
          expect(callbackResult2).toEqual(enumContext1);
        });

        it("should skip when enum value is undefined", () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.ENUM,
              id: 1,
              valuePath: [{ type: "TUPLE", offset: 0 }],
            },
          };
          const args = { ...defaultArgs, context };
          const extractedValues = [new Uint8Array([])]; // Empty array
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(0);
        });

        it("should create callback with enum id 0", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.ENUM,
              id: 0,
              valuePath: [{ type: "TUPLE", offset: 0 }],
            },
          };
          const enumContext1: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 0,
            value: 0,
            payload: "enum context 1",
          };
          const enumContext2: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 1,
            value: 1,
            payload: "enum context 2",
          };
          const args = {
            ...defaultArgs,
            context,
            contextOptional: [enumContext1, enumContext2],
          };
          const extractedValues = [new Uint8Array([0x01, 0x00])];
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(1);
          const callback = result.subcontextCallbacks[0]!;
          const callbackResult = await callback();
          expect(callbackResult).toEqual(enumContext1);
        });

        it("should skip when no matching enum context found", () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.ENUM,
              id: 1,
              valuePath: [{ type: "TUPLE", offset: 0 }],
            },
          };
          const enumContext: ClearSignContextSuccess = {
            type: ClearSignContextType.ENUM,
            id: 2, // Different ID
            value: 2,
            payload: "enum context",
          };
          const args = {
            ...defaultArgs,
            context,
            contextOptional: [enumContext],
          };
          const extractedValues = [new Uint8Array([0x01, 0x02])];
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(0);
        });
      });

      describe("for TOKEN type", () => {
        it("should create callbacks to get token context", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.TOKEN,
              valuePath: [{ type: "TUPLE", offset: 0 }],
            },
          };
          const args = { ...defaultArgs, context };
          const extractedValues = [
            new Uint8Array([
              0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
              0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
            ]),
          ];
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );
          contextModuleMock.getContext.mockResolvedValue({
            type: ClearSignContextType.TOKEN,
            payload: "token result",
          });

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(1);
          const callback = result.subcontextCallbacks[0]!;
          const callbackResult = await callback();
          expect(callbackResult).toEqual({
            type: ClearSignContextType.TOKEN,
            payload: "token result",
          });
          expect(contextModuleMock.getContext).toHaveBeenCalledWith({
            type: ClearSignContextType.TOKEN,
            chainId: 1,
            address: "0x030405060708090a0b0c0d0e0f10111213141516",
          });
        });

        it("should create callbacks to get token as constant", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.TOKEN,
              value: "0x030405060708090a0b0c0d0e0f10111213141516",
            },
          };
          const args = { ...defaultArgs, context };
          contextModuleMock.getContext.mockResolvedValue({
            type: ClearSignContextType.TOKEN,
            payload: "token result",
          });

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(1);
          const callback = result.subcontextCallbacks[0]!;
          const callbackResult = await callback();
          expect(callbackResult).toEqual({
            type: ClearSignContextType.TOKEN,
            payload: "token result",
          });
          expect(contextModuleMock.getContext).toHaveBeenCalledWith({
            type: ClearSignContextType.TOKEN,
            chainId: 1,
            address: "0x030405060708090a0b0c0d0e0f10111213141516",
          });
        });
      });

      describe("for NFT type", () => {
        it("should create callbacks to get NFT context", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.NFT,
              valuePath: [{ type: "TUPLE", offset: 0 }],
            },
          };
          const args = { ...defaultArgs, context };
          const extractedValues = [
            new Uint8Array([
              0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
              0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
            ]),
          ];
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );
          contextModuleMock.getContext.mockResolvedValue({
            type: ClearSignContextType.NFT,
            payload: "nft result",
          });

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(1);
          const callback = result.subcontextCallbacks[0]!;
          const callbackResult = await callback();
          expect(callbackResult).toEqual({
            type: ClearSignContextType.NFT,
            payload: "nft result",
          });
          expect(contextModuleMock.getContext).toHaveBeenCalledWith({
            type: ClearSignContextType.NFT,
            chainId: 1,
            address: "0x030405060708090a0b0c0d0e0f10111213141516",
          });
        });

        it("should create callbacks to get NFT as constant", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.NFT,
              value: "0x030405060708090a0b0c0d0e0f10111213141516",
            },
          };
          const args = { ...defaultArgs, context };
          contextModuleMock.getContext.mockResolvedValue({
            type: ClearSignContextType.NFT,
            payload: "nft result",
          });

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(1);
          const callback = result.subcontextCallbacks[0]!;
          const callbackResult = await callback();
          expect(callbackResult).toEqual({
            type: ClearSignContextType.NFT,
            payload: "nft result",
          });
          expect(contextModuleMock.getContext).toHaveBeenCalledWith({
            type: ClearSignContextType.NFT,
            chainId: 1,
            address: "0x030405060708090a0b0c0d0e0f10111213141516",
          });
        });
      });

      describe("for TRUSTED_NAME type", () => {
        it("should create callbacks to get trusted name context with challenge", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.TRUSTED_NAME,
              valuePath: [{ type: "TUPLE", offset: 0 }],
              types: ["type1", "type2"],
              sources: ["source1", "source2"],
            },
          };
          const args = { ...defaultArgs, context };
          const extractedValues = [
            new Uint8Array([
              0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
              0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
            ]),
          ];
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );
          contextModuleMock.getContext.mockResolvedValue({
            type: ClearSignContextType.TRUSTED_NAME,
            payload: "trusted name result",
          });

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(1);
          const callback = result.subcontextCallbacks[0]!;
          const callbackResult = await callback();
          expect(callbackResult).toEqual({
            type: ClearSignContextType.TRUSTED_NAME,
            payload: "trusted name result",
          });
          expect(apiMock.sendCommand).toHaveBeenCalledWith(
            expect.any(GetChallengeCommand),
          );
          expect(contextModuleMock.getContext).toHaveBeenCalledWith({
            type: ClearSignContextType.TRUSTED_NAME,
            chainId: 1,
            address: "0x030405060708090a0b0c0d0e0f10111213141516",
            challenge: "test-challenge",
            types: ["type1", "type2"],
            sources: ["source1", "source2"],
          });
        });

        it("should handle challenge command failure", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.TRUSTED_NAME,
              valuePath: [{ type: "TUPLE", offset: 0 }],
              types: ["type1"],
              sources: ["source1"],
            },
          };
          const args = { ...defaultArgs, context };
          const extractedValues = [
            new Uint8Array([
              0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
              0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
            ]),
          ];
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );
          const error = new UnknownDeviceExchangeError("Failed");
          apiMock.sendCommand.mockResolvedValueOnce(
            CommandResultFactory({
              error,
            }),
          );

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(1);
          const callback = result.subcontextCallbacks[0]!;
          const callbackResult = await callback();
          expect(callbackResult).toEqual({
            error: new Error("Failed to get challenge"),
            type: ClearSignContextType.ERROR,
          });
        });
      });

      describe("for multiple values", () => {
        it("should create callbacks for each extracted value", async () => {
          // GIVEN
          const context: ClearSignContextSuccess = {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "test payload",
            reference: {
              type: ClearSignContextReferenceType.TOKEN,
              valuePath: [{ type: "TUPLE", offset: 0 }],
            },
          };
          const args = { ...defaultArgs, context };
          const extractedValues = [
            new Uint8Array([
              0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
              0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
            ]),
            new Uint8Array([
              0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b,
              0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36,
            ]),
          ];
          transactionParserMock.extractValue.mockReturnValue(
            Right(extractedValues),
          );
          contextModuleMock.getContext.mockResolvedValueOnce({
            type: ClearSignContextType.TOKEN,
            payload: "token result 1",
          });
          contextModuleMock.getContext.mockResolvedValueOnce({
            type: ClearSignContextType.TOKEN,
            payload: "token result 2",
          });

          // WHEN
          const result = new BuildSubcontextsTask(apiMock, args).run();

          // THEN
          expect(result.subcontextCallbacks).toHaveLength(2);
          const callback1 = result.subcontextCallbacks[0]!;
          const callback2 = result.subcontextCallbacks[1]!;
          const callbackResult1 = await callback1();
          const callbackResult2 = await callback2();
          expect(callbackResult1).toEqual({
            type: ClearSignContextType.TOKEN,
            payload: "token result 1",
          });
          expect(callbackResult2).toEqual({
            type: ClearSignContextType.TOKEN,
            payload: "token result 2",
          });
          expect(contextModuleMock.getContext).toHaveBeenCalledTimes(2);
          expect(contextModuleMock.getContext).toHaveBeenNthCalledWith(1, {
            type: ClearSignContextType.TOKEN,
            chainId: 1,
            address: "0x030405060708090a0b0c0d0e0f10111213141516",
          });
          expect(contextModuleMock.getContext).toHaveBeenNthCalledWith(2, {
            type: ClearSignContextType.TOKEN,
            chainId: 1,
            address: "0x232425262728292a2b2c2d2e2f30313233343536",
          });
        });
      });
    });
  });

  describe("when context has no reference", () => {
    it("should return context with empty subcontextCallbacks", () => {
      // GIVEN
      const context: ClearSignContextSuccess = {
        type: ClearSignContextType.TOKEN,
        payload: "test payload",
      };
      const args = { ...defaultArgs, context };

      // WHEN
      const result = new BuildSubcontextsTask(apiMock, args).run();

      // THEN
      expect(result.subcontextCallbacks).toHaveLength(0);
    });
  });

  describe("when context has reference but no valuePath", () => {
    it("should return context with empty subcontextCallbacks", () => {
      // GIVEN
      const context: ClearSignContextSuccess = {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "test payload",
        reference: {
          type: ClearSignContextReferenceType.TOKEN,
          valuePath: undefined as unknown as GenericPath,
        },
      };
      const args = { ...defaultArgs, context };

      // WHEN
      const result = new BuildSubcontextsTask(apiMock, args).run();

      // THEN
      expect(result.subcontextCallbacks).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle value array shorter than 20 bytes for address extraction", async () => {
      // GIVEN
      const context: ClearSignContextSuccess = {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "test payload",
        reference: {
          type: ClearSignContextReferenceType.TOKEN,
          valuePath: [{ type: "TUPLE", offset: 0 }],
        },
      };
      const args = { ...defaultArgs, context };
      const extractedValues = [new Uint8Array([0x01, 0x02, 0x03])]; // Only 3 bytes
      transactionParserMock.extractValue.mockReturnValue(
        Right(extractedValues),
      );
      contextModuleMock.getContext.mockResolvedValue({
        type: ClearSignContextType.ERROR,
        message: "Invalid address",
      });

      // WHEN
      const result = new BuildSubcontextsTask(apiMock, args).run();

      // THEN
      expect(result.subcontextCallbacks).toHaveLength(1);
      const callback = result.subcontextCallbacks[0]!;
      const callbackResult = await callback();
      expect(callbackResult).toEqual({
        type: ClearSignContextType.ERROR,
        message: "Invalid address",
      });
      expect(contextModuleMock.getContext).toHaveBeenCalledWith({
        type: ClearSignContextType.TOKEN,
        chainId: 1,
        address: "0x010203",
      });
    });

    it("should handle empty value array", async () => {
      // GIVEN
      const context: ClearSignContextSuccess = {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "test payload",
        reference: {
          type: ClearSignContextReferenceType.TOKEN,
          valuePath: [{ type: "TUPLE", offset: 0 }],
        },
      };
      const args = { ...defaultArgs, context };
      const extractedValues = [new Uint8Array([])]; // Empty array
      transactionParserMock.extractValue.mockReturnValue(
        Right(extractedValues),
      );
      contextModuleMock.getContext.mockResolvedValue({
        type: ClearSignContextType.TOKEN,
        payload: "token result",
      });

      // WHEN
      const result = new BuildSubcontextsTask(apiMock, args).run();

      // THEN
      expect(result.subcontextCallbacks).toHaveLength(1);

      // Verify the callback calls getContext with empty address
      const callback = result.subcontextCallbacks[0]!;
      const callbackResult = await callback();
      expect(callbackResult).toEqual({
        type: ClearSignContextType.TOKEN,
        payload: "token result",
      });
      expect(contextModuleMock.getContext).toHaveBeenCalledWith({
        type: ClearSignContextType.TOKEN,
        chainId: 1,
        address: "0x",
      });
    });
  });
});
