import {
  type ClearSignContextSuccess,
  type ClearSignContextSuccessType,
  ClearSignContextType,
  type ContextModule,
  type PkiCertificate,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import { ProvideTransactionFieldDescriptionTask } from "./ProvideTransactionFieldDescriptionTask";
import {
  ProvideTransactionGenericContextTask,
  type ProvideTransactionGenericContextTaskArgs,
} from "./ProvideTransactionGenericContextTask";
import { SendCommandInChunksTask } from "./SendCommandInChunksTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

describe("ProvideTransactionGenericContextTask", () => {
  const derivationPath = "44/60'/0'/0'/0/0";
  const serializedTransaction = new Uint8Array([0x12, 0x34]);
  const transactionInfo = "0x5678";
  const transactionFields: ClearSignContextSuccess<
    Exclude<ClearSignContextSuccessType, ClearSignContextType.ENUM>
  >[] = [];
  const transactionEnums: ClearSignContextSuccess<ClearSignContextType.ENUM>[] =
    [];
  const chainId = 1;
  const transactionParser = {} as TransactionParserService;
  const contextModule = {} as ContextModule;
  const transactionInfoCertificate: PkiCertificate = {
    keyUsageNumber: 0,
    payload: new Uint8Array([0x12, 0x34]),
  };

  const defaultArgs: ProvideTransactionGenericContextTaskArgs = {
    derivationPath,
    serializedTransaction,
    context: {
      transactionInfo,
      transactionInfoCertificate,
      transactionFields,
      transactionEnums,
      web3Check: null,
    },
    chainId,
    transactionParser,
    contextModule,
  };

  const apiMock = makeDeviceActionInternalApiMock();
  const taskFactoryMock = vi
    .fn()
    .mockReturnValue({ run: vi.fn().mockResolvedValue(Nothing) });

  describe("run", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("should return an error", () => {
      it("when storeTransactionResult fail", async () => {
        // GIVEN
        vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            error: new InvalidStatusWordError("storeTransactionError"),
          }),
        );
        // loadCertificateCommand
        vi.spyOn(apiMock, "sendCommand").mockResolvedValueOnce(
          CommandResultFactory({
            data: undefined,
          }),
        );

        // WHEN
        const result = await new ProvideTransactionGenericContextTask(
          apiMock,
          defaultArgs,
        ).run();

        // THEN
        expect(result).toEqual(
          Just(
            CommandResultFactory({
              error: new InvalidStatusWordError("storeTransactionError"),
            }),
          ),
        );
      });

      it("when provideTransactionInformationResult fail", async () => {
        // GIVEN
        vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            data: "0x1234",
          }),
        );
        vi.spyOn(SendPayloadInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            error: new InvalidStatusWordError(
              "provideTransactionInformationError",
            ),
          }),
        );
        // loadCertificateCommand
        vi.spyOn(apiMock, "sendCommand").mockResolvedValueOnce(
          CommandResultFactory({
            data: undefined,
          }),
        );

        // WHEN
        const result = await new ProvideTransactionGenericContextTask(
          apiMock,
          defaultArgs,
        ).run();

        // THEN
        expect(result).toEqual(
          Just(
            CommandResultFactory({
              error: new InvalidStatusWordError(
                "provideTransactionInformationError",
              ),
            }),
          ),
        );
      });

      it("when ProvideTransactionGenericContextTask fail", async () => {
        // GIVEN
        vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            data: "0x1234",
          }),
        );
        vi.spyOn(SendPayloadInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            data: "0x5678",
          }),
        );
        vi.spyOn(
          ProvideTransactionFieldDescriptionTask.prototype,
          "run",
        ).mockResolvedValue(
          Just(
            CommandResultFactory({
              error: new InvalidStatusWordError(
                "provideTransactionGenericContextTaskError",
              ),
            }) as CommandErrorResult,
          ),
        );
        // loadCertificateCommand
        vi.spyOn(apiMock, "sendCommand").mockResolvedValueOnce(
          CommandResultFactory({
            data: undefined,
          }),
        );

        // WHEN
        const result = await new ProvideTransactionGenericContextTask(apiMock, {
          ...defaultArgs,
          context: {
            transactionInfo,
            transactionInfoCertificate,
            transactionFields: [
              {} as ClearSignContextSuccess<ClearSignContextType.TRANSACTION_INFO>,
            ],
            transactionEnums,
            web3Check: null,
          },
        }).run();

        // THEN
        expect(result).toEqual(
          Just(
            CommandResultFactory({
              error: new InvalidStatusWordError(
                "provideTransactionGenericContextTaskError",
              ),
            }),
          ),
        );
      });
    });

    it("should call ProvideTransactionFieldDescriptionTask for each field", async () => {
      // GIVEN
      const fields: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION>[] =
        [
          "field-1" as unknown as ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION>,
          "field-2" as unknown as ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION>,
        ];

      // WHEN
      await new ProvideTransactionGenericContextTask(
        apiMock,
        {
          ...defaultArgs,
          context: {
            transactionInfo,
            transactionInfoCertificate,
            transactionFields: fields,
            transactionEnums,
            web3Check: null,
          },
        },
        taskFactoryMock,
      ).run();

      // THEN
      expect(taskFactoryMock).toHaveBeenCalledTimes(2);
      expect(taskFactoryMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          field: fields[0],
        }),
      );
      expect(taskFactoryMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          field: fields[1],
        }),
      );
    });

    it("should return Nothing when all fields are provided", async () => {
      // GIVEN
      vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({
          data: "0x1234",
        }),
      );
      vi.spyOn(SendPayloadInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({
          data: "0x5678",
        }),
      );
      vi.spyOn(
        ProvideTransactionFieldDescriptionTask.prototype,
        "run",
      ).mockResolvedValue(Nothing);
      // loadCertificateCommand
      vi.spyOn(apiMock, "sendCommand").mockResolvedValueOnce(
        CommandResultFactory({
          data: undefined,
        }),
      );

      // WHEN
      const result = await new ProvideTransactionGenericContextTask(
        apiMock,
        defaultArgs,
      ).run();

      // THEN
      expect(result).toEqual(Nothing);
    });

    it("should return Nothing when web3 check is provided", async () => {
      // WHEN
      const result = await new ProvideTransactionGenericContextTask(
        apiMock,
        {
          ...defaultArgs,
          context: {
            ...defaultArgs.context,
            web3Check: {
              type: ClearSignContextType.WEB3_CHECK,
              payload: "0x1234",
              certificate: {
                payload: new Uint8Array(),
                keyUsageNumber: 1,
              },
            },
          },
        },
        taskFactoryMock,
      ).run();

      // THEN
      expect(result).toEqual(Nothing);
      expect(taskFactoryMock).toHaveBeenCalledTimes(1);
      expect(taskFactoryMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          field: {
            type: ClearSignContextType.WEB3_CHECK,
            payload: "0x1234",
            certificate: {
              payload: new Uint8Array(),
              keyUsageNumber: 1,
            },
          },
        }),
      );
    });

    it("should load the transaction info certificate", async () => {
      // GIVEN
      vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({
          data: "0x1234",
        }),
      );
      vi.spyOn(SendPayloadInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({
          data: "0x5678",
        }),
      );
      vi.spyOn(
        ProvideTransactionFieldDescriptionTask.prototype,
        "run",
      ).mockResolvedValue(Nothing);

      // WHEN
      await new ProvideTransactionGenericContextTask(apiMock, {
        ...defaultArgs,
        context: {
          transactionInfo,
          transactionInfoCertificate,
          transactionFields,
          transactionEnums,
          web3Check: null,
        },
      }).run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    });
  });
});
