import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  LoadCertificateCommand,
  type UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import { ProvideEnumCommand } from "@internal/app-binder/command/ProvideEnumCommand";
import {
  NetworkConfigurationType,
  ProvideNetworkConfigurationCommand,
} from "@internal/app-binder/command/ProvideNetworkConfigurationCommand";
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideProxyInfoCommand } from "@internal/app-binder/command/ProvideProxyInfoCommand";
import {
  ProvideSafeAccountCommand,
  ProvideSafeAccountCommandType,
} from "@internal/app-binder/command/ProvideSafeAccountCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { SetExternalPluginCommand } from "@internal/app-binder/command/SetExternalPluginCommand";
import { SetPluginCommand } from "@internal/app-binder/command/SetPluginCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import {
  ProvideContextTask,
  type ProvideContextTaskArgs,
} from "./ProvideContextTask";
import {
  SendPayloadInChunksTask,
  type SendPayloadInChunksTaskArgs,
} from "./SendPayloadInChunksTask";

describe("ProvideContextTask", () => {
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
    const sendPayloadInChunksTaskMockFactory = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      sendPayloadInChunksTaskMockFactory.mockImplementation(
        (a: InternalApi, args: SendPayloadInChunksTaskArgs<unknown>) =>
          ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            run: () => sendPayloadInChunksRunMock(a, args),
          }) as unknown as SendPayloadInChunksTask<unknown>,
      );
    });

    describe("contexts with sendCommand", () => {
      it.each([
        [ClearSignContextType.PLUGIN, SetPluginCommand],
        [ClearSignContextType.EXTERNAL_PLUGIN, SetExternalPluginCommand],
        [ClearSignContextType.NFT, ProvideNFTInformationCommand],
        [ClearSignContextType.TOKEN, ProvideTokenInformationCommand],
      ] as const)(
        "should provide context by calling sendCommand for a %s context",
        async (contextType, commandClass) => {
          // GIVEN
          const args: ProvideContextTaskArgs = {
            context: {
              type: contextType,
              payload: "payload",
            },
          };
          api.sendCommand.mockResolvedValue(successResult);

          // WHEN
          const task = new ProvideContextTask(
            api,
            args,
            sendPayloadInChunksTaskMockFactory,
          );
          const result = await task.run();

          // THEN
          expect(result).toEqual(successResult);
          expect(api.sendCommand).toHaveBeenCalledTimes(1);
          expect(api.sendCommand).toHaveBeenCalledWith(
            expect.any(commandClass),
          );
        },
      );
    });

    describe("contexts with sendPayloadInChunksTask", () => {
      it.each([
        [
          ClearSignContextType.TRANSACTION_INFO,
          ProvideTransactionInformationCommand,
        ],
        [ClearSignContextType.TRUSTED_NAME, ProvideTrustedNameCommand],
        [ClearSignContextType.ENUM, ProvideEnumCommand],
        [
          ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          ProvideTransactionFieldDescriptionCommand,
        ],
        [ClearSignContextType.TRANSACTION_CHECK, ProvideWeb3CheckCommand],
        [ClearSignContextType.PROXY_INFO, ProvideProxyInfoCommand],
      ] as const)(
        "should provide context by calling sendPayloadInChunksTask for a %s context",
        async (contextType, commandClass) => {
          // GIVEN
          const args: ProvideContextTaskArgs = {
            context: {
              type: contextType,
              payload: "payload",
            } as ClearSignContextSuccess<typeof contextType>,
          };
          sendPayloadInChunksRunMock.mockResolvedValue(successResult);

          // WHEN
          const task = new ProvideContextTask(
            api,
            args,
            sendPayloadInChunksTaskMockFactory,
          );
          const result = await task.run();

          // THEN
          expect(result).toEqual(successResult);
          expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);
          expect(sendPayloadInChunksRunMock).toHaveBeenCalledWith(api, {
            payload: "payload",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            commandFactory: expect.any(Function),
          });

          // Test that the commandFactory returns the correct command class
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

      it("should provide context for DYNAMIC_NETWORK with correct configuration type", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.DYNAMIC_NETWORK,
            payload: "payload",
          },
        };
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(successResult);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);

        // Test that the commandFactory returns ProvideNetworkConfigurationCommand with CONFIGURATION type
        const factoryCall = sendPayloadInChunksTaskMockFactory.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory = factoryCall[1].commandFactory;
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(ProvideNetworkConfigurationCommand);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(command.args.configurationType).toBe(
          NetworkConfigurationType.CONFIGURATION,
        );
      });

      it("should provide context for DYNAMIC_NETWORK_ICON with correct configuration type and withPayloadLength", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.DYNAMIC_NETWORK_ICON,
            payload: "payload",
          },
        };
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(successResult);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledWith(api, {
          payload: "payload",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          commandFactory: expect.any(Function),
          withPayloadLength: false,
        });

        // Test that the commandFactory returns ProvideNetworkConfigurationCommand with ICON type
        const factoryCall = sendPayloadInChunksTaskMockFactory.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory = factoryCall[1].commandFactory;
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(ProvideNetworkConfigurationCommand);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(command.args.configurationType).toBe(
          NetworkConfigurationType.ICON,
        );
      });

      it("should provide context for SAFE with correct type", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.SAFE,
            payload: "payload",
          },
        };
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(successResult);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);

        // Test that the commandFactory returns ProvideSafeAccountCommand with SAFE_DESCRIPTOR type
        const factoryCall = sendPayloadInChunksTaskMockFactory.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory = factoryCall[1].commandFactory;
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(ProvideSafeAccountCommand);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(command.args.type).toBe(
          ProvideSafeAccountCommandType.SAFE_DESCRIPTOR,
        );
      });

      it("should provide context for SIGNER with correct type", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.SIGNER,
            payload: "payload",
          },
        };
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(successResult);
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);

        // Test that the commandFactory returns ProvideSafeAccountCommand with SIGNER_DESCRIPTOR type
        const factoryCall = sendPayloadInChunksTaskMockFactory.mock.calls[0]!;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const commandFactory = factoryCall[1].commandFactory;
        const mockArgs = {
          chunkedData: new Uint8Array([1, 2, 3]),
          isFirstChunk: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const command = commandFactory(mockArgs);
        expect(command).toBeInstanceOf(ProvideSafeAccountCommand);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(command.args.type).toBe(
          ProvideSafeAccountCommandType.SIGNER_DESCRIPTOR,
        );
      });
    });

    describe("with certificate", () => {
      it("should load certificate before providing context when certificate is present", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.TOKEN,
            payload: "payload",
            certificate: {
              keyUsageNumber: 1,
              payload: new Uint8Array([1, 2, 3]),
            },
          },
        };
        api.sendCommand.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(successResult);
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

      it("should load certificate with sendPayloadInChunksTask context", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "payload",
            certificate: {
              keyUsageNumber: 2,
              payload: new Uint8Array([4, 5, 6]),
            },
          },
        };
        api.sendCommand.mockResolvedValue(successResult);
        sendPayloadInChunksRunMock.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(successResult);
        expect(api.sendCommand).toHaveBeenCalledTimes(1);
        expect(api.sendCommand).toHaveBeenCalledWith(
          expect.any(LoadCertificateCommand),
        );
        expect(sendPayloadInChunksRunMock).toHaveBeenCalledTimes(1);
      });

      it("should not load certificate when not present", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.TOKEN,
            payload: "payload",
          },
        };
        api.sendCommand.mockResolvedValue(successResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(successResult);
        expect(api.sendCommand).toHaveBeenCalledTimes(1);
        expect(api.sendCommand).toHaveBeenCalledWith(
          expect.any(ProvideTokenInformationCommand),
        );
      });
    });

    describe("error handling", () => {
      it("should return error when sendCommand fails", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.NFT,
            payload: "payload",
          },
        };
        api.sendCommand.mockResolvedValue(errorResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(errorResult);
      });

      it("should return error when sendPayloadInChunksTask fails", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.TRUSTED_NAME,
            payload: "payload",
          },
        };
        sendPayloadInChunksRunMock.mockResolvedValue(errorResult);

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(errorResult);
      });

      it("should return error for unsupported context type", async () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: "unsupported" as unknown as ClearSignContextType.TOKEN,
            payload: "payload",
          },
        };

        // WHEN
        const task = new ProvideContextTask(
          api,
          args,
          sendPayloadInChunksTaskMockFactory,
        );
        const result = await task.run();

        // THEN
        expect(result).toEqual(
          CommandResultFactory({
            error: new InvalidStatusWordError(
              `The context type [unsupported] is not covered`,
            ),
          }),
        );
      });
    });

    describe("factory", () => {
      it("should have a default sendPayloadInChunksTaskFactory", () => {
        // GIVEN
        const args: ProvideContextTaskArgs = {
          context: {
            type: ClearSignContextType.TOKEN,
            payload: "payload",
          },
        };

        // WHEN
        const task = new ProvideContextTask(api, args);

        // THEN
        expect(task["_sendPayloadInChunksTaskFactory"]).toBeDefined();
        const sendPayloadInChunksTask = task["_sendPayloadInChunksTaskFactory"](
          api,
          {
            payload: "payload",
            commandFactory: () =>
              new ProvideTransactionInformationCommand({
                data: new Uint8Array(),
                isFirstChunk: true,
              }),
          },
        );
        expect(sendPayloadInChunksTask).toBeInstanceOf(SendPayloadInChunksTask);
      });
    });
  });
});
