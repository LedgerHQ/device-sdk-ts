import {
  type ClearSignContextSuccess,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

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
  const transactionFields: ClearSignContextSuccess[] = [];
  const chainId = 1;
  const transactionParser = {} as TransactionParserService;
  const contextModule = {} as ContextModule;

  const defaultArgs: ProvideTransactionGenericContextTaskArgs = {
    derivationPath,
    serializedTransaction,
    context: {
      transactionInfo,
      transactionFields,
    },
    chainId,
    transactionParser,
    contextModule,
  };
  describe("run", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    describe("should return an error", () => {
      it("when storeTransactionResult fail", async () => {
        // GIVEN
        jest.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            error: new InvalidStatusWordError("storeTransactionError"),
          }),
        );

        // WHEN
        const result = await new ProvideTransactionGenericContextTask(
          {} as InternalApi,
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
        jest.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            data: "0x1234",
          }),
        );
        jest.spyOn(SendPayloadInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            error: new InvalidStatusWordError(
              "provideTransactionInformationError",
            ),
          }),
        );

        // WHEN
        const result = await new ProvideTransactionGenericContextTask(
          {} as InternalApi,
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
        jest.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            data: "0x1234",
          }),
        );
        jest.spyOn(SendPayloadInChunksTask.prototype, "run").mockResolvedValue(
          CommandResultFactory({
            data: "0x5678",
          }),
        );
        jest
          .spyOn(ProvideTransactionFieldDescriptionTask.prototype, "run")
          .mockResolvedValue(
            Just(
              CommandResultFactory({
                error: new InvalidStatusWordError(
                  "provideTransactionGenericContextTaskError",
                ),
              }) as CommandErrorResult,
            ),
          );

        // WHEN
        const result = await new ProvideTransactionGenericContextTask(
          {} as InternalApi,
          {
            ...defaultArgs,
            context: {
              transactionInfo,
              transactionFields: [{} as ClearSignContextSuccess],
            },
          },
        ).run();

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
      const fields: ClearSignContextSuccess[] = [
        "field-1" as unknown as ClearSignContextSuccess,
        "field-2" as unknown as ClearSignContextSuccess,
      ];
      jest.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({
          data: "0x1234",
        }),
      );
      jest.spyOn(SendPayloadInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({
          data: "0x5678",
        }),
      );
      jest
        .spyOn(ProvideTransactionFieldDescriptionTask.prototype, "run")
        .mockResolvedValue(Nothing);

      // WHEN
      await new ProvideTransactionGenericContextTask({} as InternalApi, {
        ...defaultArgs,
        context: {
          transactionInfo,
          transactionFields: fields,
        },
      }).run();

      // THEN
      expect(
        ProvideTransactionFieldDescriptionTask.prototype.run,
      ).toHaveBeenCalledTimes(2);
    });

    it("should return Nothing when all fields are provided", async () => {
      // GIVEN
      jest.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({
          data: "0x1234",
        }),
      );
      jest.spyOn(SendPayloadInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({
          data: "0x5678",
        }),
      );
      jest
        .spyOn(ProvideTransactionFieldDescriptionTask.prototype, "run")
        .mockResolvedValue(Nothing);

      // WHEN
      const result = await new ProvideTransactionGenericContextTask(
        {} as InternalApi,
        defaultArgs,
      ).run();

      // THEN
      expect(result).toEqual(Nothing);
    });
  });
});
