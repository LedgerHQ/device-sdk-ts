import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  DYNAMIC_NETWORK_CONTEXT_TYPES,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  InvalidStatusWordError,
  TransportDeviceModel,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendGetAddressTask } from "./SendGetAddressTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const mockLoggerFactory = (_tag: string) => mockLogger;

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";
const EXPECTED_ADDRESS = "0xF7C69BedB292Dd3fC2cA4103989B5BD705164c43" as const;
const EXPECTED_PUBLIC_KEY =
  "04e3785ca6a5aa748c625e3dddd6d97b59b26fd8152fb52eb29d24404f010be4f725c3725e78bed953f074778d717974de21f3470b735736eb3d56747ab6d073a7";

const successGetAddressResult = CommandResultFactory({
  data: {
    address: EXPECTED_ADDRESS,
    publicKey: EXPECTED_PUBLIC_KEY,
  },
});

describe("SendGetAddressTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const contextModuleMock = {
    getContexts: vi.fn(),
  };

  const baseArgs = {
    contextModule: contextModuleMock as unknown as ContextModule,
    derivationPath: DEFAULT_DERIVATION_PATH,
    checkOnDevice: false,
    returnChainCode: false,
    loggerFactory: mockLoggerFactory,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.getDeviceModel.mockReturnValue({
      id: DeviceModelId.STAX,
      productName: "STAX",
      usbProductId: 1,
      bootloaderUsbProductId: 2,
      usbOnly: false,
      memorySize: 0,
      getBlockSize: () => 0,
      masks: [],
    } as TransportDeviceModel);
    apiMock.sendCommand.mockImplementation((command: { name?: string }) => {
      if (command?.name === "getAddress") {
        return Promise.resolve(successGetAddressResult);
      }
      return Promise.resolve(CommandResultFactory({ data: {} }));
    });
  });

  describe("run", () => {
    it("should send GetAddressCommand and return result when chainId is undefined", async () => {
      const task = new SendGetAddressTask(apiMock, baseArgs);
      const result = await task.run();

      expect(result).toEqual(successGetAddressResult);
      expect(contextModuleMock.getContexts).not.toHaveBeenCalled();
      expect(apiMock.getDeviceModel).not.toHaveBeenCalled();
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(apiMock.sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "getAddress",
        }),
      );
    });

    it("should send GetAddressCommand with correct args (checkOnDevice, returnChainCode, chainId)", async () => {
      contextModuleMock.getContexts.mockResolvedValue([]);

      const task = new SendGetAddressTask(apiMock, {
        ...baseArgs,
        checkOnDevice: true,
        returnChainCode: true,
        chainId: 137,
      });
      await task.run();

      expect(apiMock.sendCommand).toHaveBeenLastCalledWith(
        expect.objectContaining({
          name: "getAddress",
          args: expect.objectContaining({
            derivationPath: DEFAULT_DERIVATION_PATH,
            checkOnDevice: true,
            returnChainCode: true,
            chainId: 137,
          }),
        }),
      );
    });

    it("should load dynamic network context and provide contexts when chainId is defined and checkOnDevice is true", async () => {
      const dynamicNetworkContext: ClearSignContextSuccess<ClearSignContextType.DYNAMIC_NETWORK> =
        {
          type: ClearSignContextType.DYNAMIC_NETWORK,
          payload: "0x01",
        };
      const dynamicNetworkIconContext: ClearSignContextSuccess<ClearSignContextType.DYNAMIC_NETWORK_ICON> =
        {
          type: ClearSignContextType.DYNAMIC_NETWORK_ICON,
          payload: "0x02",
        };
      contextModuleMock.getContexts.mockResolvedValue([
        dynamicNetworkContext,
        dynamicNetworkIconContext,
      ]);

      const task = new SendGetAddressTask(apiMock, {
        ...baseArgs,
        checkOnDevice: true,
        chainId: 137,
      });
      const result = await task.run();

      expect(result).toEqual(successGetAddressResult);
      expect(apiMock.getDeviceModel).toHaveBeenCalled();
      expect(contextModuleMock.getContexts).toHaveBeenCalledTimes(1);
      expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
        {
          chainId: 137,
          deviceModelId: DeviceModelId.STAX,
        },
        DYNAMIC_NETWORK_CONTEXT_TYPES,
      );
      expect(apiMock.sendCommand).toHaveBeenCalled();
      const getAddressCall = (
        apiMock.sendCommand as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { name?: string })?.name === "getAddress",
      );
      expect(getAddressCall).toBeDefined();
    });

    it("should not call getContexts when chainId is undefined", async () => {
      const task = new SendGetAddressTask(apiMock, baseArgs);
      await task.run();

      expect(contextModuleMock.getContexts).not.toHaveBeenCalled();
    });

    it("should ignore chainId when checkOnDevice is false", async () => {
      const task = new SendGetAddressTask(apiMock, {
        ...baseArgs,
        checkOnDevice: false,
        chainId: 137,
      });
      const result = await task.run();

      expect(result).toEqual(successGetAddressResult);
      expect(contextModuleMock.getContexts).not.toHaveBeenCalled();
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(apiMock.sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({ name: "getAddress" }),
      );
    });

    it("should skip ERROR contexts and only provide success contexts", async () => {
      const dynamicNetworkContext: ClearSignContextSuccess<ClearSignContextType.DYNAMIC_NETWORK> =
        {
          type: ClearSignContextType.DYNAMIC_NETWORK,
          payload: "0x01",
        };
      contextModuleMock.getContexts.mockResolvedValue([
        { type: ClearSignContextType.ERROR, error: new Error("load failed") },
        dynamicNetworkContext,
      ]);

      const task = new SendGetAddressTask(apiMock, {
        ...baseArgs,
        checkOnDevice: true,
        chainId: 56,
      });
      const result = await task.run();

      expect(result).toEqual(successGetAddressResult);
      expect(apiMock.sendCommand).toHaveBeenCalled();
    });

    it("should send GetAddressCommand when chainId is defined but getContexts returns empty array", async () => {
      contextModuleMock.getContexts.mockResolvedValue([]);

      const task = new SendGetAddressTask(apiMock, {
        ...baseArgs,
        checkOnDevice: true,
        chainId: 1,
      });
      const result = await task.run();

      expect(result).toEqual(successGetAddressResult);
      expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
        { chainId: 1, deviceModelId: DeviceModelId.STAX },
        DYNAMIC_NETWORK_CONTEXT_TYPES,
      );
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(apiMock.sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({ name: "getAddress" }),
      );
    });

    it("should ignore context provision errors and still send GetAddressCommand", async () => {
      const dynamicNetworkContext: ClearSignContextSuccess<ClearSignContextType.DYNAMIC_NETWORK> =
        {
          type: ClearSignContextType.DYNAMIC_NETWORK,
          payload: "0x01",
        };
      contextModuleMock.getContexts.mockResolvedValue([dynamicNetworkContext]);

      const contextError = CommandResultFactory({
        data: undefined,
        error: new InvalidStatusWordError("Context provision failed"),
      });
      let callCount = 0;
      apiMock.sendCommand.mockImplementation((command: { name?: string }) => {
        callCount++;
        if (command?.name === "getAddress") {
          return Promise.resolve(successGetAddressResult);
        }
        if (callCount === 1) {
          return Promise.resolve(contextError);
        }
        return Promise.resolve(CommandResultFactory({ data: {} }));
      });

      const task = new SendGetAddressTask(apiMock, {
        ...baseArgs,
        checkOnDevice: true,
        chainId: 137,
      });
      const result = await task.run();

      expect(result).toEqual(successGetAddressResult);
      expect(apiMock.sendCommand).toHaveBeenCalled();
    });
  });
});
