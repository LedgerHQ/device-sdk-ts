import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  LoadCertificateCommand,
  type UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { ProvideEnumCommand } from "@internal/app-binder/command/ProvideEnumCommand";
import { ProvideNetworkConfigurationCommand } from "@internal/app-binder/command/ProvideNetworkConfigurationCommand";
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideProxyInfoCommand } from "@internal/app-binder/command/ProvideProxyInfoCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { SetExternalPluginCommand } from "@internal/app-binder/command/SetExternalPluginCommand";
import { SetPluginCommand } from "@internal/app-binder/command/SetPluginCommand";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import {
  ProvideContextsTask,
  type ProvideContextsTaskArgs,
} from "./ProvideContextsTask";
import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";
import {
  SendPayloadInChunksTask,
  type SendPayloadInChunksTaskArgs,
} from "./SendPayloadInChunksTask";

describe("ProvideContextsTask", () => {
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
    const sendPayloadInChunksRunMock = vi.fn();
    const sendCommandInChunksTaskRunMock = vi.fn();
    const sendCommandInChunksTaskMockFactory = vi.fn();
    const sendPayloadInChunksTaskMockFactory = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      sendCommandInChunksTaskMockFactory.mockImplementation(
        (a: InternalApi, args: SendCommandInChunksTaskArgs<unknown>) =>
          ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            run: () => sendCommandInChunksTaskRunMock(a, args),
          }) as unknown as SendCommandInChunksTask<unknown>,
      );
      sendPayloadInChunksTaskMockFactory.mockImplementation(
        (a: InternalApi, args: SendPayloadInChunksTaskArgs<unknown>) =>
          ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            run: () => sendPayloadInChunksRunMock(a, args),
          }) as unknown as SendPayloadInChunksTask<unknown>,
      );
    });

    describe("with no subcontexts", () => {
      it("should provide the transaction context for a TRANSACTION_INFO context", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRANSACTION_INFO,
                payload: "0x00",
                certificate: {
                  keyUsageNumber: 1,
                  payload: new Uint8Array([1, 2, 3]),
                },
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        sendCommandInChunksTaskRunMock.mockResolvedValue(successResult);
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);
        api.sendCommand.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));

        // StoreTransactionCommand
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
        // arbitrary data to test the commandFactory
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3, 4]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(StoreTransactionCommand);

        // LoadCertificateCommand
        expect(api.sendCommand).toHaveBeenCalledTimes(1);
        expect(api.sendCommand).toHaveBeenCalledWith(
          expect.any(LoadCertificateCommand),
        );

        // ProvideTransactionInformationCommand
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledWith(api, {
          payload: "0x00",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          commandFactory: expect.any(Function),
        });
        // Test that the commandFactory returns a ProvideTransactionInformationCommand
        const factoryCall2 = sendPayloadInChunksRunMock.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory2 = factoryCall2[1].commandFactory;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command2 = commandFactory2(mockArgs);
        expect(command2).toBeInstanceOf(ProvideTransactionInformationCommand);
      });

      it("should provide the transaction context for a TRANSACTION_INFO context without certificate", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
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
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);
        api.sendCommand.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));

        // StoreTransactionCommand
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
        // arbitrary data to test the commandFactory
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3, 4]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(StoreTransactionCommand);

        // LoadCertificateCommand
        expect(api.sendCommand).toHaveBeenCalledTimes(0);

        // ProvideTransactionInformationCommand
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledWith(api, {
          payload: "0x00",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          commandFactory: expect.any(Function),
        });
        // Test that the commandFactory returns a ProvideTransactionInformationCommand
        const factoryCall2 = sendPayloadInChunksRunMock.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory2 = factoryCall2[1].commandFactory;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command2 = commandFactory2(mockArgs);
        expect(command2).toBeInstanceOf(ProvideTransactionInformationCommand);
      });

      it.each([
        [ClearSignContextType.PLUGIN, SetPluginCommand],
        [ClearSignContextType.EXTERNAL_PLUGIN, SetExternalPluginCommand],
        [ClearSignContextType.NFT, ProvideNFTInformationCommand],
        [ClearSignContextType.TOKEN, ProvideTokenInformationCommand],
      ] as const)(
        "should provide the transaction context by calling sendCommand for a %s context",
        async (contextType, commandClass) => {
          // GIVEN
          const args: ProvideContextsTaskArgs = {
            contexts: [
              {
                context: {
                  type: contextType,
                  payload: "payload",
                },
                subcontextCallbacks: [],
              },
            ],
            serializedTransaction: new Uint8Array(),
            derivationPath: "44'/60'/0'/0/0",
          };
          api.sendCommand.mockResolvedValue(successResult);

          // WHEN
          const task = new ProvideContextsTask(
            api,
            args,
            sendPayloadInChunksTaskMockFactory,
            sendCommandInChunksTaskMockFactory,
          );
          const result = await task.run();

          // THEN
          expect(result).toEqual(Right(void 0));
          expect(api.sendCommand).toHaveBeenCalledTimes(1);
          expect(api.sendCommand).toHaveBeenCalledWith(
            expect.any(commandClass),
          );
        },
      );

      it.each([
        [ClearSignContextType.ENUM, ProvideEnumCommand],
        [ClearSignContextType.TRUSTED_NAME, ProvideTrustedNameCommand],
        [ClearSignContextType.WEB3_CHECK, ProvideWeb3CheckCommand],
        [
          ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          ProvideTransactionFieldDescriptionCommand,
        ],
        [ClearSignContextType.PROXY_DELEGATE_CALL, ProvideProxyInfoCommand],
        [
          ClearSignContextType.DYNAMIC_NETWORK_ICON,
          ProvideNetworkConfigurationCommand,
          false,
        ],
        [
          ClearSignContextType.DYNAMIC_NETWORK,
          ProvideNetworkConfigurationCommand,
        ],
      ] as const)(
        "should provide the transaction context by calling sendPayloadInChunksTask for a %s context",
        async (contextType, commandClass, withPayloadLength = undefined) => {
          // GIVEN
          const args: ProvideContextsTaskArgs = {
            contexts: [
              {
                context: {
                  type: contextType,
                  payload: "payload",
                  id: 1,
                  value: 1,
                },
                subcontextCallbacks: [],
              },
            ],
            serializedTransaction: new Uint8Array(),
            derivationPath: "44'/60'/0'/0/0",
          };
          sendPayloadInChunksRunMock.mockResolvedValue(successResult);

          // WHEN
          const task = new ProvideContextsTask(
            api,
            args,
            sendPayloadInChunksTaskMockFactory,
            sendCommandInChunksTaskMockFactory,
          );
          const result = await task.run();

          // THEN
          expect(result).toEqual(Right(void 0));
          expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);
          if (withPayloadLength === undefined) {
            expect(sendPayloadInChunksRunMock).toHaveBeenCalledWith(api, {
              payload: "payload",
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              commandFactory: expect.any(Function),
            });
          } else {
            expect(sendPayloadInChunksRunMock).toHaveBeenCalledWith(api, {
              payload: "payload",
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              commandFactory: expect.any(Function),
              withPayloadLength,
            });
          }

          // Test that the commandFactory returns a commandClass
          const factoryCall = sendPayloadInChunksTaskMockFactory.mock.calls[0]!;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const commandFactory = factoryCall[1].commandFactory;
          const mockArgs = {
            chunkedData: new Uint8Array([1, 2, 3]),
            isFirstChunk: true,
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          const command = commandFactory(mockArgs);
          expect(command).toBeInstanceOf(commandClass);
        },
      );

      it("should skip the subcontexts if the context is an error", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TOKEN,
                payload: "payload",
                certificate: {
                  keyUsageNumber: 1,
                  payload: new Uint8Array([1, 2, 3]),
                },
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
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);
        api.sendCommand.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(0);
        expect(sendCommandInChunksTaskRunMock).toHaveBeenCalledTimes(0);
        expect(api.sendCommand).toHaveBeenCalledTimes(2);
        expect(api.sendCommand).toHaveBeenNthCalledWith(
          1,
          expect.any(LoadCertificateCommand),
        );
        expect(api.sendCommand).toHaveBeenNthCalledWith(
          2,
          expect.any(ProvideTokenInformationCommand),
        );
      });
    });

    describe("with subcontexts", () => {
      it("should provide the transaction context and subcontext for a TRANSACTION_FIELD_DESCRIPTION context", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
                payload: "payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.TOKEN,
                    payload: "payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);
        api.sendCommand.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledWith(api, {
          payload: "payload",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          commandFactory: expect.any(Function),
        });

        // Test that the commandFactory returns a commandClass
        const factoryCall = sendPayloadInChunksTaskMockFactory.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory = factoryCall[1].commandFactory;
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(
          ProvideTransactionFieldDescriptionCommand,
        );

        expect(api.sendCommand).toHaveBeenCalledTimes(1);
        expect(api.sendCommand).toHaveBeenCalledWith(
          expect.any(ProvideTokenInformationCommand),
        );
      });

      it("should provide the transaction context and subcontexts for a TRUSTED_NAME context", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRUSTED_NAME,
                payload: "payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.NFT,
                    payload: "payload1",
                  }),

                () =>
                  Promise.resolve({
                    type: ClearSignContextType.TOKEN,
                    payload: "payload2",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);
        api.sendCommand.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledWith(api, {
          payload: "payload",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          commandFactory: expect.any(Function),
        });

        // Test that the commandFactory returns a commandClass
        const factoryCall = sendPayloadInChunksTaskMockFactory.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory = factoryCall[1].commandFactory;
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(ProvideTrustedNameCommand);

        expect(api.sendCommand).toHaveBeenCalledTimes(2);
        expect(api.sendCommand).toHaveBeenNthCalledWith(
          1,
          expect.any(ProvideNFTInformationCommand),
        );
        expect(api.sendCommand).toHaveBeenNthCalledWith(
          2,
          expect.any(ProvideTokenInformationCommand),
        );
      });
    });

    describe("with subcontexts and certificate", () => {
      it("should provide the transaction context and subcontexts for a TRUSTED_NAME context", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TRUSTED_NAME,
                payload: "payload",
                certificate: {
                  keyUsageNumber: 1,
                  payload: new Uint8Array([1, 2, 3]),
                },
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.NFT,
                    payload: "payload1",
                    certificate: {
                      keyUsageNumber: 2,
                      payload: new Uint8Array([4, 5, 6]),
                    },
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);
        api.sendCommand.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        await task.run();

        // THEN
        expect(api.sendCommand).toHaveBeenCalledTimes(3);
        expect(api.sendCommand).toHaveBeenNthCalledWith(
          1,
          expect.any(LoadCertificateCommand),
        );
        expect(api.sendCommand).toHaveBeenNthCalledWith(
          2,
          expect.any(ProvideNFTInformationCommand),
        );
        expect(api.sendCommand).toHaveBeenNthCalledWith(
          3,
          expect.any(LoadCertificateCommand),
        );
      });
    });

    describe("with error", () => {
      it("should return an error if the provideContext fails", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
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
        api.sendCommand.mockResolvedValue(errorResult);

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Left(errorResult));
      });

      it("should return an error if the provide subcontext fails", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.TOKEN,
                    payload: "payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };
        api.sendCommand.mockResolvedValue(errorResult);

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(Left(errorResult));
      });

      it("should return an error if the type is not supported", async () => {
        // GIVEN
        const args: ProvideContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: "unsupported" as unknown as ClearSignContextType.TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
        };

        // WHEN
        const task = new ProvideContextsTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(
          Left(
            CommandResultFactory({
              error: new InvalidStatusWordError(
                `The context type [unsupported] is not covered`,
              ),
            }),
          ),
        );
      });
    });

    describe("factory types", () => {
      it("should have a sendPayloadInChunksTaskFactory by default", () => {
        // GIVEN
        const task = new ProvideContextsTask(api, {
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
        expect(task["_sendPayloadInChunksTaskFactory"]).toBeDefined();
        const sendPayloadInChunksTask = task["_sendPayloadInChunksTaskFactory"](
          api,
          {
            payload: "payload",
            commandFactory: () =>
              new ProvideTransactionFieldDescriptionCommand({
                data: new Uint8Array(),
                isFirstChunk: true,
              }),
          },
        );
        expect(sendPayloadInChunksTask).toBeInstanceOf(SendPayloadInChunksTask);
      });

      it("should have a sendCommandInChunksTaskFactory by default", () => {
        // GIVEN
        const task = new ProvideContextsTask(api, {
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
        expect(task["_sendCommandInChunksTaskFactory"]).toBeDefined();
        const sendCommandInChunksTask = task["_sendCommandInChunksTaskFactory"](
          api,
          {
            data: new Uint8Array(),
            commandFactory: () =>
              new StoreTransactionCommand({
                serializedTransaction: new Uint8Array(),
                isFirstChunk: true,
              }),
          },
        );
        expect(sendCommandInChunksTask).toBeInstanceOf(SendCommandInChunksTask);
      });
    });
  });
});
