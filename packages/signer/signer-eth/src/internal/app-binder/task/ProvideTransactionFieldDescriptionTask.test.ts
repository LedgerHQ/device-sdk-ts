import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  ContainerPath,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Left, Nothing, Right } from "purify-ts";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { ProvideEnumCommand } from "@internal/app-binder/command/ProvideEnumCommand";
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import { ProvideTransactionFieldDescriptionTask } from "./ProvideTransactionFieldDescriptionTask";

describe("ProvideTransactionFieldDescriptionTask", () => {
  const transactionParserMock = {
    extractValue: jest.fn(),
  } as unknown as TransactionParserService;
  const contextModuleMock = {
    getContext: jest.fn(),
  } as unknown as ContextModule;
  const apiMock: InternalApi = {
    sendCommand: jest.fn(),
  } as unknown as InternalApi;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("should call the right provide command", () => {
    it.each<{
      type: ClearSignContextSuccess["type"];
      commandInstanceType: unknown;
    }>([
      {
        type: ClearSignContextType.NFT,
        commandInstanceType: ProvideNFTInformationCommand,
      },
      {
        type: ClearSignContextType.TOKEN,
        commandInstanceType: ProvideTokenInformationCommand,
      },
      {
        type: ClearSignContextType.TRUSTED_NAME,
        commandInstanceType: ProvideTrustedNameCommand,
      },
      {
        type: ClearSignContextType.ENUM,
        commandInstanceType: ProvideEnumCommand,
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        commandInstanceType: ProvideTransactionFieldDescriptionCommand,
      },
    ])("when type is $type", async ({ type, commandInstanceType }) => {
      // GIVEN
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));
      const payload = `0x01020304`;
      const field: ClearSignContextSuccess = {
        type,
        payload,
      };

      // WHEN
      await new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      }).run();

      // THEN
      expect(
        (apiMock.sendCommand as jest.Mock).mock.calls[0][0],
      ).toBeInstanceOf(commandInstanceType);
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe("should return nothing", () => {
    it.each<ClearSignContextSuccess["type"]>([
      ClearSignContextType.NFT,
      ClearSignContextType.TOKEN,
      ClearSignContextType.TRUSTED_NAME,
      ClearSignContextType.ENUM,
      ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
    ])("when type is %s with no reference", async (type) => {
      // GIVEN
      const payload = `0x01020304`;
      const field: ClearSignContextSuccess = {
        type,
        payload,
      };
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(result).toEqual(Nothing);
    });
  });

  describe("should provide a reference context", () => {
    it.each<ClearSignContextSuccess["type"]>([
      ClearSignContextType.NFT,
      ClearSignContextType.TOKEN,
    ])("when type is %s with a reference", async (type) => {
      // GIVEN
      const payload = `0x01020304`;
      const field: ClearSignContextSuccess = {
        type,
        payload,
        reference: {
          type: ClearSignContextType.TOKEN,
          valuePath: ContainerPath.VALUE,
        },
      };
      // provide reference context
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));
      // provide context
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));
      jest
        .spyOn(transactionParserMock, "extractValue")
        .mockReturnValueOnce(Right([new Uint8Array([0x01, 0x02, 0x03, 0x04])]));
      jest
        .spyOn(contextModuleMock, "getContext")
        .mockResolvedValueOnce({ type, payload });

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(contextModuleMock.getContext).toHaveBeenCalledTimes(1);
      expect(contextModuleMock.getContext).toHaveBeenCalledWith({
        type: ClearSignContextType.TOKEN,
        chainId: 1,
        address: "0x01020304",
      });
      expect(result).toEqual(Nothing);
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    });

    it("when type is trustes-name with a reference", async () => {
      // GIVEN
      const payload1 = `0x01020304`;
      const payload2 = `0x05060708`;
      const extractedValue = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
      const extractedValueAddress = "0x11223344";
      const field: ClearSignContextSuccess = {
        type: ClearSignContextType.TRUSTED_NAME,
        payload: payload1,
        reference: {
          type: ClearSignContextType.TRUSTED_NAME,
          valuePath: ContainerPath.VALUE,
          types: ["type"],
          sources: ["source"],
        },
      };
      // getChallenge
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(
          CommandResultFactory({ data: { challenge: 0x42 } }),
        );
      // provide reference context
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));
      // provide context
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));
      jest
        .spyOn(transactionParserMock, "extractValue")
        .mockReturnValueOnce(Right([extractedValue]));
      jest.spyOn(contextModuleMock, "getContext").mockResolvedValueOnce({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: payload2,
      });

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(contextModuleMock.getContext).toHaveBeenCalledTimes(1);
      // getContext for the extracted value address
      expect(contextModuleMock.getContext).toHaveBeenCalledWith({
        type: ClearSignContextType.TRUSTED_NAME,
        chainId: 1,
        address: extractedValueAddress,
        types: ["type"],
        sources: ["source"],
        challenge: 0x42,
      });
      expect(result).toEqual(Nothing);
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        1,
        new GetChallengeCommand(),
      );
      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        2,
        new ProvideTrustedNameCommand({
          data: new Uint8Array([0x00, 0x04, 0x05, 0x06, 0x07, 0x08]),
          isFirstChunk: true,
        }),
      );
      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        3,
        new ProvideTrustedNameCommand({
          data: new Uint8Array([0x00, 0x04, 0x01, 0x02, 0x03, 0x04]),
          isFirstChunk: true,
        }),
      );
    });
  });

  describe("should not provide a reference context", () => {
    it("when the path is not found in transaction payload", async () => {
      // GIVEN
      const payload = `0x01020304`;
      const field: ClearSignContextSuccess = {
        type: ClearSignContextType.TRUSTED_NAME,
        payload,
        reference: {
          type: ClearSignContextType.TRUSTED_NAME,
          valuePath: ContainerPath.VALUE,
          types: ["type"],
          sources: ["source"],
        },
      };
      // provide context
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));
      jest
        .spyOn(transactionParserMock, "extractValue")
        .mockReturnValueOnce(Left(new Error("path not found")));

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(result).toEqual(Nothing);
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(contextModuleMock.getContext).not.toHaveBeenCalled();
    });

    it("when getContext return a type error", async () => {
      // GIVEN
      const payload = `0x01020304`;
      const field: ClearSignContextSuccess = {
        type: ClearSignContextType.TRUSTED_NAME,
        payload,
        reference: {
          type: ClearSignContextType.TRUSTED_NAME,
          valuePath: ContainerPath.VALUE,
          types: ["type"],
          sources: ["source"],
        },
      };
      jest
        .spyOn(transactionParserMock, "extractValue")
        .mockReturnValueOnce(Right([new Uint8Array([0x11, 0x22, 0x33, 0x44])]));
      jest.spyOn(contextModuleMock, "getContext").mockResolvedValueOnce({
        type: ClearSignContextType.ERROR,
        error: new Error("getContext error"),
      });
      // getChallenge
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(
          CommandResultFactory({ data: { challenge: 0x42 } }),
        );
      // provide context
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(result).toEqual(Nothing);
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect(contextModuleMock.getContext).toHaveBeenCalledTimes(1);
    });
  });

  describe("should return an error", () => {
    it.each<ClearSignContextSuccess["type"]>([
      ClearSignContextType.TRANSACTION_INFO,
      ClearSignContextType.PLUGIN,
      ClearSignContextType.EXTERNAL_PLUGIN,
    ])("when type is %s", async (type) => {
      // GIVEN
      const payload = `payload-${type}`;
      const field: ClearSignContextSuccess = {
        type,
        payload,
      };

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(result.extract()).toEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError(
            `The context type [${type}] is not valid as a transaction field or metadata`,
          ),
        }),
      );
    });

    it("when type is unknown", async () => {
      // GIVEN
      const payload = `payload-unknown`;
      const field: ClearSignContextSuccess = {
        type: "unknown" as ClearSignContextType,
        payload,
      } as ClearSignContextSuccess;

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(result.extract()).toEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError(
            `The context type [unknown] is not covered`,
          ),
        }),
      );
    });

    it("when getChallenge fails", async () => {
      // GIVEN
      const payload = `0x01020304`;
      const field: ClearSignContextSuccess = {
        type: ClearSignContextType.TRUSTED_NAME,
        payload,
        reference: {
          type: ClearSignContextType.TRUSTED_NAME,
          valuePath: ContainerPath.VALUE,
          types: ["type"],
          sources: ["source"],
        },
      };
      jest.spyOn(apiMock, "sendCommand").mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("getChallenge error"),
        }),
      );
      jest
        .spyOn(transactionParserMock, "extractValue")
        .mockReturnValueOnce(Right([new Uint8Array([0x11, 0x22, 0x33, 0x44])]));

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(result.extract()).toEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("getChallenge error"),
        }),
      );
    });

    it("when provide reference fails", async () => {
      // GIVEN
      const payload = `0x01020304`;
      const field: ClearSignContextSuccess = {
        type: ClearSignContextType.TRUSTED_NAME,
        payload,
        reference: {
          type: ClearSignContextType.TRUSTED_NAME,
          valuePath: ContainerPath.VALUE,
          types: ["type"],
          sources: ["source"],
        },
      };
      // getChallenge
      jest
        .spyOn(apiMock, "sendCommand")
        .mockResolvedValueOnce(CommandResultFactory({ data: "ok" }));
      // provide reference context
      jest.spyOn(apiMock, "sendCommand").mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("provide reference error"),
        }),
      );
      jest
        .spyOn(transactionParserMock, "extractValue")
        .mockReturnValueOnce(Right([new Uint8Array([0x11, 0x22, 0x33, 0x44])]));
      jest.spyOn(contextModuleMock, "getContext").mockResolvedValueOnce({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: "0x05060708",
      });

      // WHEN
      const task = new ProvideTransactionFieldDescriptionTask(apiMock, {
        field,
        serializedTransaction: new Uint8Array(),
        chainId: 1,
        transactionParser: transactionParserMock,
        contextModule: contextModuleMock,
      });
      const result = await task.run();

      // THEN
      expect(result.extract()).toEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("provide reference error"),
        }),
      );
    });
  });
});
