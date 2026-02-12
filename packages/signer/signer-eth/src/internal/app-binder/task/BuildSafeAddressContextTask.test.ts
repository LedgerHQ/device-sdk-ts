import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  type UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import {
  BuildSafeAddressContextTask,
  type BuildSafeAddressContextTaskArgs,
} from "./BuildSafeAddressContextTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const mockLoggerFactory = (_tag: string) => mockLogger;

describe("BuildSafeAddressContextTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const contextModuleMock = {
    getContexts: vi.fn(),
  };

  const TEST_CHALLENGE = "0x12345678";
  const TEST_SAFE_ADDRESS = "0x1234567890123456789012345678901234567890";
  const TEST_CHAIN_ID = 1;

  const successChallengeResult = CommandResultFactory({
    data: { challenge: TEST_CHALLENGE },
  });

  const errorResult = CommandResultFactory({
    data: undefined,
    error: {} as UnknownDeviceExchangeError,
  });

  const validSafeContext: ClearSignContextSuccess<ClearSignContextType.SAFE> = {
    type: ClearSignContextType.SAFE,
    payload: "safe_payload",
  };

  const validSignerContext: ClearSignContextSuccess<ClearSignContextType.SIGNER> =
    {
      type: ClearSignContextType.SIGNER,
      payload: "signer_payload",
    };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("run", () => {
    it("should successfully build safe address contexts with valid SAFE and SIGNER contexts", async () => {
      // GIVEN
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([validSafeContext, validSignerContext]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);
      const result = await task.run();

      // THEN
      expect(result).toEqual({
        clearSignContexts: [validSafeContext, validSignerContext],
      });
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
        {
          safeContractAddress: TEST_SAFE_ADDRESS,
          chainId: TEST_CHAIN_ID,
          deviceModelId: DeviceModelId.FLEX,
          challenge: TEST_CHALLENGE,
        },
        [ClearSignContextType.SAFE, ClearSignContextType.SIGNER],
      );
    });

    it("should include certificates when provided in contexts", async () => {
      // GIVEN
      const safeContextWithCert: ClearSignContextSuccess<ClearSignContextType.SAFE> =
        {
          type: ClearSignContextType.SAFE,
          payload: "safe_payload",
          certificate: {
            keyUsageNumber: 1,
            payload: new Uint8Array([1, 2, 3]),
          },
        };
      const signerContextWithCert: ClearSignContextSuccess<ClearSignContextType.SIGNER> =
        {
          type: ClearSignContextType.SIGNER,
          payload: "signer_payload",
          certificate: {
            keyUsageNumber: 2,
            payload: new Uint8Array([4, 5, 6]),
          },
        };
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([safeContextWithCert, signerContextWithCert]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);
      const result = await task.run();

      // THEN
      expect(result).toEqual({
        clearSignContexts: [safeContextWithCert, signerContextWithCert],
      });
    });
  });

  describe("error handling", () => {
    it("should throw error when GetChallengeCommand fails", async () => {
      // GIVEN
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(errorResult);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("Failed to get challenge");
    });

    it("should throw error when context contains ERROR type", async () => {
      // GIVEN
      const errorContext: ClearSignContext = {
        type: ClearSignContextType.ERROR,
        error: new Error("Context error"),
      };
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([errorContext, validSignerContext]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("Context error");
    });

    it("should throw error when only one context is returned", async () => {
      // GIVEN
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([validSafeContext]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("Invalid safe address contexts");
    });

    it("should throw error when no contexts are returned", async () => {
      // GIVEN
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi.fn().mockResolvedValue([]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("Invalid safe address contexts");
    });

    it("should throw error when more than two contexts are returned", async () => {
      // GIVEN
      const extraContext: ClearSignContextSuccess<ClearSignContextType.TOKEN> =
        {
          type: ClearSignContextType.TOKEN,
          payload: "extra_payload",
        };
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([
          validSafeContext,
          validSignerContext,
          extraContext,
        ]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("Invalid safe address contexts");
    });

    it("should throw error when SAFE context is missing", async () => {
      // GIVEN
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([validSignerContext, validSignerContext]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("Invalid safe address contexts");
    });

    it("should throw error when SIGNER context is missing", async () => {
      // GIVEN
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([validSafeContext, validSafeContext]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("Invalid safe address contexts");
    });

    it("should throw error when contexts are of wrong types", async () => {
      // GIVEN
      const wrongContext1: ClearSignContextSuccess<ClearSignContextType.TOKEN> =
        {
          type: ClearSignContextType.TOKEN,
          payload: "token_payload",
        };
      const wrongContext2: ClearSignContextSuccess<ClearSignContextType.NFT> = {
        type: ClearSignContextType.NFT,
        payload: "nft_payload",
      };
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([wrongContext1, wrongContext2]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("Invalid safe address contexts");
    });

    it("should throw error with multiple ERROR contexts", async () => {
      // GIVEN
      const errorContext1: ClearSignContext = {
        type: ClearSignContextType.ERROR,
        error: new Error("First error"),
      };
      const errorContext2: ClearSignContext = {
        type: ClearSignContextType.ERROR,
        error: new Error("Second error"),
      };
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(successChallengeResult);
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([errorContext1, errorContext2]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);

      // THEN
      await expect(task.run()).rejects.toThrow("First error");
    });
  });

  describe("device model variants", () => {
    it.each([
      [DeviceModelId.NANO_S, "Nano S"],
      [DeviceModelId.NANO_SP, "Nano S Plus"],
      [DeviceModelId.NANO_X, "Nano X"],
      [DeviceModelId.FLEX, "Flex"],
      [DeviceModelId.STAX, "Stax"],
    ])(
      "should successfully build contexts for %s device",
      async (deviceModelId, _deviceName) => {
        // GIVEN
        const args: BuildSafeAddressContextTaskArgs = {
          contextModule: contextModuleMock as unknown as ContextModule,
          safeContractAddress: TEST_SAFE_ADDRESS,
          options: { chainId: TEST_CHAIN_ID },
          deviceModelId,
          loggerFactory: mockLoggerFactory,
        };
        apiMock.sendCommand.mockResolvedValue(successChallengeResult);
        contextModuleMock.getContexts = vi
          .fn()
          .mockResolvedValue([validSafeContext, validSignerContext]);

        // WHEN
        const task = new BuildSafeAddressContextTask(apiMock, args);
        const result = await task.run();

        // THEN
        expect(result).toEqual({
          clearSignContexts: [validSafeContext, validSignerContext],
        });
        expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceModelId,
          }),
          [ClearSignContextType.SAFE, ClearSignContextType.SIGNER],
        );
      },
    );
  });

  describe("challenge handling", () => {
    it("should pass the correct challenge to contextModule", async () => {
      // GIVEN
      const customChallenge = "0xabcdef12";
      const args: BuildSafeAddressContextTaskArgs = {
        contextModule: contextModuleMock as unknown as ContextModule,
        safeContractAddress: TEST_SAFE_ADDRESS,
        options: { chainId: TEST_CHAIN_ID },
        deviceModelId: DeviceModelId.FLEX,
        loggerFactory: mockLoggerFactory,
      };
      apiMock.sendCommand.mockResolvedValue(
        CommandResultFactory({
          data: { challenge: customChallenge },
        }),
      );
      contextModuleMock.getContexts = vi
        .fn()
        .mockResolvedValue([validSafeContext, validSignerContext]);

      // WHEN
      const task = new BuildSafeAddressContextTask(apiMock, args);
      await task.run();

      // THEN
      expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge: customChallenge,
        }),
        [ClearSignContextType.SAFE, ClearSignContextType.SIGNER],
      );
    });
  });
});
