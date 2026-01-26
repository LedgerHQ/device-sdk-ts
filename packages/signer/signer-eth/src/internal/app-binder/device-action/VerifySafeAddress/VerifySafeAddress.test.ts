/* eslint @typescript-eslint/consistent-type-imports: 0 */
import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
  TransportDeviceModel,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { lastValueFrom, Observable } from "rxjs";

import {
  VerifySafeAddressDAError,
  VerifySafeAddressDAIntermediateValue,
  type VerifySafeAddressDAState,
  VerifySafeAddressDAStep,
} from "@api/app-binder/VerifySafeAddressDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { executeUntilStep } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionUntilStep";

import { VerifySafeAddressDeviceAction } from "./VerifySafeAddress";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

describe("VerifySafeAddressDeviceAction", () => {
  let observable: Observable<
    DeviceActionState<
      void,
      VerifySafeAddressDAError,
      VerifySafeAddressDAIntermediateValue
    >
  >;
  const contextModuleMock = {
    getContexts: vi.fn(),
  };
  const buildSafeAddressContextsMock = vi.fn();
  const provideContextsMock = vi.fn();

  function extractDependenciesMock() {
    return {
      buildSafeAddressContexts: buildSafeAddressContextsMock,
      provideContexts: provideContextsMock,
    };
  }

  const apiMock = makeDeviceActionInternalApiMock();
  const TEST_SAFE_ADDRESS = "0x1234567890123456789012345678901234567890";
  const TEST_CHAIN_ID = 1;

  const validSafeContext = {
    type: ClearSignContextType.SAFE,
    payload: "safe_payload",
  };

  const validSignerContext = {
    type: ClearSignContextType.SIGNER,
    payload: "signer_payload",
  };

  function setupDeviceModel(deviceModelId: DeviceModelId) {
    apiMock.getDeviceModel.mockReturnValue({
      id: deviceModelId,
    } as unknown as TransportDeviceModel);
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.15.0" },
      deviceModelId,
      isSecureConnectionAllowed: false,
    });
  }

  const getStep = (s: Array<VerifySafeAddressDAState>, index: number) => {
    if (s[index]?.status !== DeviceActionStatus.Pending) {
      throw new Error(
        `Step ${index} is not pending: ${JSON.stringify(s[index])}`,
      );
    }
    return s[index];
  };

  describe("Happy path", () => {
    describe("should verify safe address", () => {
      beforeEach(() => {
        vi.resetAllMocks();
        setupOpenAppDAMock();
        setupDeviceModel(DeviceModelId.FLEX);

        // Mock the dependencies to return some sample data
        buildSafeAddressContextsMock.mockResolvedValueOnce({
          clearSignContexts: [validSafeContext, validSignerContext],
        });
        provideContextsMock.mockResolvedValueOnce(Right(void 0));

        const deviceAction = new VerifySafeAddressDeviceAction({
          input: {
            safeContractAddress: TEST_SAFE_ADDRESS,
            options: { chainId: TEST_CHAIN_ID },
            contextModule: contextModuleMock as unknown as ContextModule,
          },
          loggerFactory: mockLoggerFactory,
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        observable = deviceAction._execute(apiMock).observable;
      });

      it("should open the app", async () => {
        const { steps } = await executeUntilStep(0, observable);
        expect(getStep(steps, 0).intermediateValue.step).toBe(
          VerifySafeAddressDAStep.OPEN_APP,
        );
      });

      it("should confirm open app", async () => {
        const { steps } = await executeUntilStep(1, observable);
        expect(
          getStep(steps, 1).intermediateValue.requiredUserInteraction,
        ).toBe(UserInteractionRequired.ConfirmOpenApp);
      });

      it("should build safe address contexts", async () => {
        const { steps } = await executeUntilStep(2, observable);
        expect(getStep(steps, 2).intermediateValue.step).toBe(
          VerifySafeAddressDAStep.BUILD_CONTEXTS,
        );
        expect(buildSafeAddressContextsMock).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              contextModule: contextModuleMock as unknown as ContextModule,
              safeContractAddress: TEST_SAFE_ADDRESS,
              options: { chainId: TEST_CHAIN_ID },
              deviceModelId: DeviceModelId.FLEX,
            }),
          }),
        );
      });

      it("should provide contexts (verify safe address)", async () => {
        const { steps } = await executeUntilStep(3, observable);
        expect(getStep(steps, 3).intermediateValue.step).toBe(
          VerifySafeAddressDAStep.VERIFY_SAFE_ADDRESS,
        );
        expect(provideContextsMock).toHaveBeenCalledWith(
          expect.objectContaining({
            input: {
              contexts: [validSafeContext, validSignerContext],
            },
          }),
        );
      });

      it("should complete successfully", async () => {
        const result = await lastValueFrom(observable);
        expect(result).toEqual({
          status: DeviceActionStatus.Completed,
          output: void 0,
        });
      });
    });

    describe("should skip open app", () => {
      beforeEach(() => {
        vi.resetAllMocks();
        setupOpenAppDAMock();
        setupDeviceModel(DeviceModelId.FLEX);

        const deviceAction = new VerifySafeAddressDeviceAction({
          input: {
            safeContractAddress: TEST_SAFE_ADDRESS,
            options: { chainId: TEST_CHAIN_ID, skipOpenApp: true },
            contextModule: contextModuleMock as unknown as ContextModule,
          },
          loggerFactory: mockLoggerFactory,
        });
        buildSafeAddressContextsMock.mockResolvedValueOnce({
          clearSignContexts: [validSafeContext, validSignerContext],
        });
        provideContextsMock.mockResolvedValueOnce(Right(void 0));

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        observable = deviceAction._execute(apiMock).observable;
      });

      it("should skip open app and build contexts directly", async () => {
        const { steps } = await executeUntilStep(0, observable);

        expect(getStep(steps, 0).intermediateValue.step).toBe(
          VerifySafeAddressDAStep.BUILD_CONTEXTS,
        );
      });
    });

    describe("should work with different device models", () => {
      it.each([
        [DeviceModelId.NANO_S, "Nano S"],
        [DeviceModelId.NANO_SP, "Nano S Plus"],
        [DeviceModelId.NANO_X, "Nano X"],
        [DeviceModelId.FLEX, "Flex"],
        [DeviceModelId.STAX, "Stax"],
      ])(
        "should verify safe address on %s device",
        async (deviceModelId, _deviceName) => {
          // GIVEN
          vi.resetAllMocks();
          setupOpenAppDAMock();
          setupDeviceModel(deviceModelId);

          buildSafeAddressContextsMock.mockResolvedValueOnce({
            clearSignContexts: [validSafeContext, validSignerContext],
          });
          provideContextsMock.mockResolvedValueOnce(Right(void 0));

          const deviceAction = new VerifySafeAddressDeviceAction({
            input: {
              safeContractAddress: TEST_SAFE_ADDRESS,
              options: { chainId: TEST_CHAIN_ID, skipOpenApp: true },
              contextModule: contextModuleMock as unknown as ContextModule,
            },
            loggerFactory: mockLoggerFactory,
          });
          vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
            extractDependenciesMock(),
          );

          observable = deviceAction._execute(apiMock).observable;

          // WHEN
          const result = await lastValueFrom(observable);

          // THEN
          expect(result).toEqual({
            status: DeviceActionStatus.Completed,
            output: void 0,
          });
          expect(buildSafeAddressContextsMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: expect.objectContaining({
                deviceModelId,
              }),
            }),
          );
        },
      );
    });

    describe("should work with contexts with certificates", () => {
      beforeEach(() => {
        vi.resetAllMocks();
        setupOpenAppDAMock();
        setupDeviceModel(DeviceModelId.FLEX);

        const safeContextWithCert = {
          type: ClearSignContextType.SAFE,
          payload: "safe_payload",
          certificate: {
            keyUsageNumber: 1,
            payload: new Uint8Array([1, 2, 3]),
          },
        };

        const signerContextWithCert = {
          type: ClearSignContextType.SIGNER,
          payload: "signer_payload",
          certificate: {
            keyUsageNumber: 2,
            payload: new Uint8Array([4, 5, 6]),
          },
        };

        buildSafeAddressContextsMock.mockResolvedValueOnce({
          clearSignContexts: [safeContextWithCert, signerContextWithCert],
        });
        provideContextsMock.mockResolvedValueOnce(Right(void 0));

        const deviceAction = new VerifySafeAddressDeviceAction({
          input: {
            safeContractAddress: TEST_SAFE_ADDRESS,
            options: { chainId: TEST_CHAIN_ID, skipOpenApp: true },
            contextModule: contextModuleMock as unknown as ContextModule,
          },
          loggerFactory: mockLoggerFactory,
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        observable = deviceAction._execute(apiMock).observable;
      });

      it("should handle contexts with certificates", async () => {
        const result = await lastValueFrom(observable);
        expect(result).toEqual({
          status: DeviceActionStatus.Completed,
          output: void 0,
        });
      });
    });
  });

  describe("Error cases", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should return an error if the open app throws an error", async () => {
      // GIVEN
      setupOpenAppDAMock(new Error("Open app failed"));
      setupDeviceModel(DeviceModelId.FLEX);
      const deviceAction = new VerifySafeAddressDeviceAction({
        input: {
          safeContractAddress: TEST_SAFE_ADDRESS,
          options: { chainId: TEST_CHAIN_ID },
          contextModule: contextModuleMock as unknown as ContextModule,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new Error("Open app failed"),
      });
    });

    it("should return an error if buildSafeAddressContexts throws an error", async () => {
      // GIVEN
      setupOpenAppDAMock();
      setupDeviceModel(DeviceModelId.FLEX);
      buildSafeAddressContextsMock.mockRejectedValueOnce(
        new Error("Failed to build contexts"),
      );
      const deviceAction = new VerifySafeAddressDeviceAction({
        input: {
          safeContractAddress: TEST_SAFE_ADDRESS,
          options: { chainId: TEST_CHAIN_ID },
          contextModule: contextModuleMock as unknown as ContextModule,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new Error("Failed to build contexts"),
      });
    });

    it("should return an error if provideContexts returns Left (error)", async () => {
      // GIVEN
      setupOpenAppDAMock();
      setupDeviceModel(DeviceModelId.FLEX);
      buildSafeAddressContextsMock.mockResolvedValueOnce({
        clearSignContexts: [validSafeContext, validSignerContext],
      });
      const provideError = new InvalidStatusWordError(
        "Failed to provide context",
      );
      provideContextsMock.mockResolvedValueOnce(Left(provideError));
      const deviceAction = new VerifySafeAddressDeviceAction({
        input: {
          safeContractAddress: TEST_SAFE_ADDRESS,
          options: { chainId: TEST_CHAIN_ID },
          contextModule: contextModuleMock as unknown as ContextModule,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: provideError,
      });
    });

    it("should return an error if provideContexts throws an error", async () => {
      // GIVEN
      setupOpenAppDAMock();
      setupDeviceModel(DeviceModelId.FLEX);
      buildSafeAddressContextsMock.mockResolvedValueOnce({
        clearSignContexts: [validSafeContext, validSignerContext],
      });
      provideContextsMock.mockRejectedValueOnce(
        new Error("Provide contexts failed"),
      );
      const deviceAction = new VerifySafeAddressDeviceAction({
        input: {
          safeContractAddress: TEST_SAFE_ADDRESS,
          options: { chainId: TEST_CHAIN_ID },
          contextModule: contextModuleMock as unknown as ContextModule,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new Error("Provide contexts failed"),
      });
    });

    it("should return an error when buildSafeAddressContexts returns invalid data", async () => {
      // GIVEN
      setupOpenAppDAMock();
      setupDeviceModel(DeviceModelId.FLEX);
      buildSafeAddressContextsMock.mockRejectedValueOnce(
        new Error("Invalid safe address contexts"),
      );
      const deviceAction = new VerifySafeAddressDeviceAction({
        input: {
          safeContractAddress: TEST_SAFE_ADDRESS,
          options: { chainId: TEST_CHAIN_ID },
          contextModule: contextModuleMock as unknown as ContextModule,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new Error("Invalid safe address contexts"),
      });
    });

    it("should handle user rejection during provide contexts", async () => {
      // GIVEN
      setupOpenAppDAMock();
      setupDeviceModel(DeviceModelId.FLEX);
      buildSafeAddressContextsMock.mockResolvedValueOnce({
        clearSignContexts: [validSafeContext, validSignerContext],
      });
      const userRejectionError = new InvalidStatusWordError("User rejected");
      (
        userRejectionError as InvalidStatusWordError & { errorCode: string }
      ).errorCode = "6985";
      provideContextsMock.mockResolvedValueOnce(Left(userRejectionError));
      const deviceAction = new VerifySafeAddressDeviceAction({
        input: {
          safeContractAddress: TEST_SAFE_ADDRESS,
          options: { chainId: TEST_CHAIN_ID },
          contextModule: contextModuleMock as unknown as ContextModule,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: userRejectionError,
      });
    });
  });
});
