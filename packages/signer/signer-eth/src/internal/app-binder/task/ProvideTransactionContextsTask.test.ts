import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type InternalApi,
  type UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import {
  type ProvideContextTask,
  type ProvideContextTaskArgs,
} from "./ProvideContextTask";
import {
  ProvideTransactionContextsTask,
  type ProvideTransactionContextsTaskArgs,
} from "./ProvideTransactionContextsTask";
import {
  type SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";

describe("ProvideTransactionContextsTask", () => {
  const api = makeDeviceActionInternalApiMock();
  const successResult = CommandResultFactory<void, EthErrorCodes>({
    data: undefined,
  });
  const errorResult = CommandResultFactory<void, EthErrorCodes>({
    data: undefined,
    error: {} as UnknownDeviceExchangeError,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("run", () => {
    const provideContextTaskRunMock = vi.fn();
    const sendCommandInChunksTaskRunMock = vi.fn();
    const provideContextTaskMockFactory = vi.fn();
    const sendCommandInChunksTaskMockFactory = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      provideContextTaskMockFactory.mockImplementation(
        (a: InternalApi, args: ProvideContextTaskArgs) =>
          ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            run: () => provideContextTaskRunMock(a, args),
          }) as unknown as ProvideContextTask,
      );
      sendCommandInChunksTaskMockFactory.mockImplementation(
        (a: InternalApi, args: SendCommandInChunksTaskArgs<unknown>) =>
          ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            run: () => sendCommandInChunksTaskRunMock(a, args),
          }) as unknown as SendCommandInChunksTask<unknown>,
      );
    });

    describe("with no subcontexts", () => {
      it("should provide the transaction context for a TRANSACTION_INFO context", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRANSACTION_INFO,
                payload: "0x00",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        sendCommandInChunksTaskRunMock.mockResolvedValue(successResult);
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));

        // StoreTransactionCommand should be called
        expect(sendCommandInChunksTaskRunMock).toHaveBeenCalledTimes(1);
        expect(sendCommandInChunksTaskMockFactory).toHaveBeenCalledWith(api, {
          data: new Uint8Array([
            0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x3c, 0x80, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          commandFactory: expect.any(Function),
        });
        // Test that the commandFactory returns a StoreTransactionCommand
        const factoryCall = sendCommandInChunksTaskMockFactory.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory = factoryCall[1].commandFactory;
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3, 4]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(StoreTransactionCommand);

        // ProvideContextTask should be called for the context
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(1);
        expect(provideContextTaskRunMock).toHaveBeenCalledWith(api, {
          context: {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "0x00",
          },
        });
      });

      it("should provide context without serialized transaction when not provided", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(sendCommandInChunksTaskRunMock).not.toHaveBeenCalled();
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(1);
      });

      it("should skip PROXY_INFO context and only provide subcontexts", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.PROXY_INFO,
                payload: "payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.PROXY_INFO,
                    payload: "subcontext payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(1);
        expect(provideContextTaskRunMock).toHaveBeenCalledWith(api, {
          context: {
            type: ClearSignContextType.PROXY_INFO,
            payload: "subcontext payload",
          },
        });
      });

      it("should skip ERROR subcontexts silently", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.ERROR,
                    error: new Error("error"),
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        // Only the main context should be provided, not the error subcontext
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(1);
        expect(provideContextTaskRunMock).toHaveBeenCalledWith(api, {
          context: {
            type: ClearSignContextType.TOKEN,
            payload: "payload",
          },
        });
      });

      it("should only store transaction once for first TRANSACTION_INFO context", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRANSACTION_INFO,
                payload: "payload1",
              },
              subcontextCallbacks: [],
            },
            {
              context: {
                type: ClearSignContextType.TRANSACTION_INFO,
                payload: "payload2",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array([1, 2, 3]),
          derivationPath: "44'/60'/0'/0/0",
        };
        sendCommandInChunksTaskRunMock.mockResolvedValue(successResult);
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        // StoreTransactionCommand should only be called once
        expect(sendCommandInChunksTaskRunMock).toHaveBeenCalledTimes(1);
        // But both contexts should be provided
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(2);
      });
    });

    describe("with subcontexts", () => {
      it("should provide subcontexts before the main context", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
                payload: "main payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.TOKEN,
                    payload: "subcontext payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(2);
        // Subcontext should be provided first
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(1, api, {
          context: {
            type: ClearSignContextType.TOKEN,
            payload: "subcontext payload",
          },
        });
        // Then main context
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(2, api, {
          context: {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "main payload",
          },
        });
      });

      it("should provide multiple subcontexts in order", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRUSTED_NAME,
                payload: "main payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.NFT,
                    payload: "subcontext1",
                  }),
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.TOKEN,
                    payload: "subcontext2",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(3);
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(1, api, {
          context: {
            type: ClearSignContextType.NFT,
            payload: "subcontext1",
          },
        });
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(2, api, {
          context: {
            type: ClearSignContextType.TOKEN,
            payload: "subcontext2",
          },
        });
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(3, api, {
          context: {
            type: ClearSignContextType.TRUSTED_NAME,
            payload: "main payload",
          },
        });
      });

      it("should continue providing main context even if subcontext fails", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
                payload: "main payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.TOKEN,
                    payload: "subcontext payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock
          .mockResolvedValueOnce(errorResult) // subcontext fails
          .mockResolvedValueOnce(successResult); // main context succeeds

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(2);
      });
    });

    describe("with multiple contexts", () => {
      it("should provide all contexts in order", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TOKEN,
                payload: "payload1",
              },
              subcontextCallbacks: [],
            },
            {
              context: {
                type: ClearSignContextType.NFT,
                payload: "payload2",
              },
              subcontextCallbacks: [],
            },
            {
              context: {
                type: ClearSignContextType.TRUSTED_NAME,
                payload: "payload3",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(3);
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(1, api, {
          context: {
            type: ClearSignContextType.TOKEN,
            payload: "payload1",
          },
        });
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(2, api, {
          context: {
            type: ClearSignContextType.NFT,
            payload: "payload2",
          },
        });
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(3, api, {
          context: {
            type: ClearSignContextType.TRUSTED_NAME,
            payload: "payload3",
          },
        });
      });
    });

    describe("error handling", () => {
      it("should return error if main context fails", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock.mockResolvedValue(errorResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Left(errorResult));
      });

      it("should stop providing contexts after first main context failure", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TOKEN,
                payload: "payload1",
              },
              subcontextCallbacks: [],
            },
            {
              context: {
                type: ClearSignContextType.NFT,
                payload: "payload2",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        provideContextTaskRunMock.mockResolvedValue(errorResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Left(errorResult));
        // Should only try to provide the first context
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(1);
      });
    });

    describe("derivation path handling", () => {
      it("should correctly parse and include derivation path in StoreTransaction", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRANSACTION_INFO,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array([0xaa, 0xbb, 0xcc]),
          derivationPath: "44'/60'/0'/0/0",
        };
        sendCommandInChunksTaskRunMock.mockResolvedValue(successResult);
        provideContextTaskRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        await task.run();

        // THEN
        expect(sendCommandInChunksTaskMockFactory).toHaveBeenCalledWith(
          api,
          expect.objectContaining({
            data: new Uint8Array([
              0x05, // path length
              0x80,
              0x00,
              0x00,
              0x2c, // 44'
              0x80,
              0x00,
              0x00,
              0x3c, // 60'
              0x80,
              0x00,
              0x00,
              0x00, // 0'
              0x00,
              0x00,
              0x00,
              0x00, // 0
              0x00,
              0x00,
              0x00,
              0x00, // 0
              0xaa,
              0xbb,
              0xcc, // transaction
            ]),
          }),
        );
      });
    });

    describe("factory types", () => {
      it("should have default factories", () => {
        // GIVEN
        const task = new ProvideTransactionContextsTask(api, {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        });

        // THEN
        expect(task["_provideContextTaskFactory"]).toBeDefined();
        expect(task["_sendCommandInChunksTaskFactory"]).toBeDefined();
      });
    });
  });
});
