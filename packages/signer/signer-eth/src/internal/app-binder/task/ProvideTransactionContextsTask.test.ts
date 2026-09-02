import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  buildProvideContactPayload,
  type ContactsErrorCodes,
  ETHEREUM_APP_NAME,
  resolveContactsVersionRequirements,
  sendProvideContactPayload,
} from "@ledgerhq/device-contacts-kit";
import {
  CommandResultFactory,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  type InternalApi,
  type UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { type EvmAddressBook } from "@api/model/EvmAddressBook";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { type ContextWithSubContexts } from "@internal/app-binder/task/BuildFullContextsTask";

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

vi.mock("@ledgerhq/device-contacts-kit", async (importOriginal) => {
  const original =
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    await importOriginal<typeof import("@ledgerhq/device-contacts-kit")>();
  return {
    ...original,
    sendProvideContactPayload: vi.fn(),
  };
});
const sendProvideContactPayloadMock = vi.mocked(sendProvideContactPayload);

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const mockLoggerFactory = (_tag: string) => mockLogger;

const minContactsAppVersion = (() => {
  const requirement = resolveContactsVersionRequirements(DeviceModelId.FLEX);
  if (!requirement.supported) throw new Error("Flex must be supported");
  const version = requirement.minAppVersion[ETHEREUM_APP_NAME];
  if (version === undefined) throw new Error("Ethereum min version required");
  return version;
})();

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
                type: ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
                payload: "0x00",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
            type: ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
            payload: "0x00",
          },
          loggerFactory: mockLoggerFactory,
        });
      });

      it("should provide context without serialized transaction when not provided", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.ETHEREUM_TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
                type: ClearSignContextType.ETHEREUM_PROXY_INFO,
                payload: "payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.ETHEREUM_PROXY_INFO,
                    payload: "subcontext payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
            type: ClearSignContextType.ETHEREUM_PROXY_INFO,
            payload: "subcontext payload",
          },
          loggerFactory: mockLoggerFactory,
        });
      });

      it("should skip TRUSTED_NAME context and only provide subcontexts", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.ETHEREUM_TRUSTED_NAME,
                payload: "main trusted name payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.ETHEREUM_TRUSTED_NAME,
                    payload: "resolved trusted name payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
        // Only the subcontext should be provided, the main TRUSTED_NAME context is skipped
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(1);
        expect(provideContextTaskRunMock).toHaveBeenCalledWith(api, {
          context: {
            type: ClearSignContextType.ETHEREUM_TRUSTED_NAME,
            payload: "resolved trusted name payload",
          },
          loggerFactory: mockLoggerFactory,
        });
      });

      it("should skip ERROR subcontexts silently", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.ETHEREUM_TOKEN,
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
          loggerFactory: mockLoggerFactory,
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
            type: ClearSignContextType.ETHEREUM_TOKEN,
            payload: "payload",
          },
          loggerFactory: mockLoggerFactory,
        });
      });

      it("should only store transaction once for first TRANSACTION_INFO context", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
                payload: "payload1",
              },
              subcontextCallbacks: [],
            },
            {
              context: {
                type: ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
                payload: "payload2",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array([1, 2, 3]),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
                type: ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
                payload: "main payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.ETHEREUM_TOKEN,
                    payload: "subcontext payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
            type: ClearSignContextType.ETHEREUM_TOKEN,
            payload: "subcontext payload",
          },
          loggerFactory: mockLoggerFactory,
        });
        // Then main context
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(2, api, {
          context: {
            type: ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
            payload: "main payload",
          },
          loggerFactory: mockLoggerFactory,
        });
      });

      it("should provide multiple subcontexts in order", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
                payload: "main payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.ETHEREUM_NFT,
                    payload: "subcontext1",
                  }),
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.ETHEREUM_TOKEN,
                    payload: "subcontext2",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
            type: ClearSignContextType.ETHEREUM_NFT,
            payload: "subcontext1",
          },
          loggerFactory: mockLoggerFactory,
        });
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(2, api, {
          context: {
            type: ClearSignContextType.ETHEREUM_TOKEN,
            payload: "subcontext2",
          },
          loggerFactory: mockLoggerFactory,
        });
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(3, api, {
          context: {
            type: ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
            payload: "main payload",
          },
          loggerFactory: mockLoggerFactory,
        });
      });

      it("should continue providing main context even if subcontext fails", async () => {
        // GIVEN
        const args: ProvideTransactionContextsTaskArgs = {
          contexts: [
            {
              context: {
                type: ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
                payload: "main payload",
              },
              subcontextCallbacks: [
                () =>
                  Promise.resolve({
                    type: ClearSignContextType.ETHEREUM_TOKEN,
                    payload: "subcontext payload",
                  }),
              ],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
                type: ClearSignContextType.ETHEREUM_TOKEN,
                payload: "payload1",
              },
              subcontextCallbacks: [],
            },
            {
              context: {
                type: ClearSignContextType.ETHEREUM_NFT,
                payload: "payload2",
              },
              subcontextCallbacks: [],
            },
            {
              context: {
                type: ClearSignContextType.ETHEREUM_PLUGIN,
                payload: "payload3",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
            type: ClearSignContextType.ETHEREUM_TOKEN,
            payload: "payload1",
          },
          loggerFactory: mockLoggerFactory,
        });
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(2, api, {
          context: {
            type: ClearSignContextType.ETHEREUM_NFT,
            payload: "payload2",
          },
          loggerFactory: mockLoggerFactory,
        });
        expect(provideContextTaskRunMock).toHaveBeenNthCalledWith(3, api, {
          context: {
            type: ClearSignContextType.ETHEREUM_PLUGIN,
            payload: "payload3",
          },
          loggerFactory: mockLoggerFactory,
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
                type: ClearSignContextType.ETHEREUM_TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
                type: ClearSignContextType.ETHEREUM_TOKEN,
                payload: "payload1",
              },
              subcontextCallbacks: [],
            },
            {
              context: {
                type: ClearSignContextType.ETHEREUM_NFT,
                payload: "payload2",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
                type: ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array([0xaa, 0xbb, 0xcc]),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
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
                type: ClearSignContextType.ETHEREUM_TOKEN,
                payload: "payload",
              },
              subcontextCallbacks: [],
            },
          ],
          serializedTransaction: new Uint8Array(),
          derivationPath: "44'/60'/0'/0/0",
          loggerFactory: mockLoggerFactory,
        });

        // THEN
        expect(task["_provideContextTaskFactory"]).toBeDefined();
        expect(task["_sendCommandInChunksTaskFactory"]).toBeDefined();
      });
    });

    describe("external contact", () => {
      const RECIPIENT = "0x1111111111111111111111111111111111111111" as const;

      const addressBook: EvmAddressBook = {
        contactGroups: [
          {
            contactName: "Alice",
            groupHandle: new Uint8Array(64).fill(0xaa),
            hmacProof: new Uint8Array(32).fill(0xbb),
            externalAddresses: [
              {
                scope: "Ethereum",
                address: RECIPIENT,
                chainId: 1n,
                hmacRest: new Uint8Array(32).fill(0xcc),
              },
            ],
          },
        ],
        ledgerAccounts: [],
      };

      const appConfig: GetConfigCommandResponse = {
        blindSigningEnabled: false,
        web3ChecksEnabled: false,
        web3ChecksOptIn: false,
        version: minContactsAppVersion,
      };

      const resolveTrustedName = vi.fn();
      const trustedName: ContextWithSubContexts = {
        context: {
          type: ClearSignContextType.ETHEREUM_TRUSTED_NAME,
          payload: "trusted name payload",
        },
        subcontextCallbacks: [resolveTrustedName],
      };

      const contactAccepted = CommandResultFactory<void, ContactsErrorCodes>({
        data: undefined,
      });
      const contactRejected = CommandResultFactory<void, ContactsErrorCodes>({
        data: undefined,
        error: {} as UnknownDeviceExchangeError,
      });

      function makeArgs(
        overrides: Partial<ProvideTransactionContextsTaskArgs> = {},
      ): ProvideTransactionContextsTaskArgs {
        return {
          contexts: [
            {
              context: {
                type: ClearSignContextType.ETHEREUM_TOKEN,
                payload: "token payload",
              },
              subcontextCallbacks: [],
            },
          ],
          derivationPath: "44'/60'/0'/0/0",
          externalContact: {
            addressBook,
            subset: {
              chainId: 1,
              to: RECIPIENT,
              data: "0x",
              selector: "0x",
            },
            appConfig,
          },
          loggerFactory: mockLoggerFactory,
          ...overrides,
        };
      }

      function run(args: ProvideTransactionContextsTaskArgs) {
        return new ProvideTransactionContextsTask(
          api,
          args,
          provideContextTaskMockFactory,
          sendCommandInChunksTaskMockFactory,
        ).run();
      }

      beforeEach(() => {
        // No `firmwareVersion`: the session refresher drops it once an app is
        // open, so this is the shape a real signing flow sees.
        api.getDeviceSessionState.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          installedApps: [],
          currentApp: { name: "Ethereum", version: minContactsAppVersion },
          deviceModelId: DeviceModelId.FLEX,
          isSecureConnectionAllowed: false,
        });
        provideContextTaskRunMock.mockResolvedValue(successResult);
        sendProvideContactPayloadMock.mockResolvedValue(contactAccepted);
        resolveTrustedName.mockResolvedValue({
          type: ClearSignContextType.ETHEREUM_TRUSTED_NAME,
          payload: "resolved trusted name payload",
        });
      });

      it("should provide the matching contact before any context", async () => {
        // WHEN
        const result = await run(makeArgs());

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(sendProvideContactPayloadMock).toHaveBeenCalledWith(api, {
          payload: buildProvideContactPayload({
            contactName: "Alice",
            scope: "Ethereum",
            identifier: new Uint8Array(20).fill(0x11),
            groupHandle: new Uint8Array(64).fill(0xaa),
            hmacProof: new Uint8Array(32).fill(0xbb),
            hmacRest: new Uint8Array(32).fill(0xcc),
            blockchainFamily: "ethereum",
            chainId: 1n,
          }),
          logger: mockLogger,
        });
        expect(
          sendProvideContactPayloadMock.mock.invocationCallOrder[0]!,
        ).toBeLessThan(provideContextTaskRunMock.mock.invocationCallOrder[0]!);
      });

      it("should skip the trusted name the contact replaces", async () => {
        // GIVEN
        const args = makeArgs({ contexts: [trustedName] });

        // WHEN
        const result = await run(args);

        // THEN
        // Neither the subcontext nor the main context reaches the device: the
        // resolved ENS name would overwrite the contact on the review screen.
        expect(result).toEqual(Right(void 0));
        expect(resolveTrustedName).not.toHaveBeenCalled();
        expect(provideContextTaskRunMock).not.toHaveBeenCalled();
      });

      it("should keep the trusted name when no contact matches the recipient", async () => {
        // GIVEN
        const args = makeArgs({
          contexts: [trustedName],
          externalContact: {
            addressBook,
            subset: {
              chainId: 8453,
              to: RECIPIENT,
              data: "0x",
              selector: "0x",
            },
            appConfig,
          },
        });

        // WHEN
        const result = await run(args);

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(sendProvideContactPayloadMock).not.toHaveBeenCalled();
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(1);
      });

      it("should sign anyway when the device rejects the contact", async () => {
        // GIVEN
        // A book that is not filtered by seed makes 0x6982 routine; the name is
        // dropped but the user still gets to sign against the raw address.
        sendProvideContactPayloadMock.mockResolvedValue(contactRejected);
        const args = makeArgs({ contexts: [trustedName] });

        // WHEN
        const result = await run(args);

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(mockLogger.warn).toHaveBeenCalled();
        // Routine, not a fault: it must not reach error-level monitoring.
        expect(mockLogger.error).not.toHaveBeenCalled();
        // The contact never made it, so the trusted name is the only name left.
        expect(provideContextTaskRunMock).toHaveBeenCalledTimes(1);
      });

      it("should send nothing when no external contact is given", async () => {
        // WHEN
        const result = await run(makeArgs({ externalContact: undefined }));

        // THEN
        expect(result).toEqual(Right(void 0));
        expect(sendProvideContactPayloadMock).not.toHaveBeenCalled();
      });
    });
  });
});
