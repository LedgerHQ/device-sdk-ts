import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  BackgroundImageCommandError,
  CLS_ERROR_NO_BACKGROUND_IMAGE,
  CLS_ERROR_RECOVERY_MODE,
} from "@api/command/BackgroundImageCommandErrors";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceInRecoveryModeDAError } from "@api/device-action/customLockScreenDeviceActionErrors";

import { GetCustomLockScreenInfoDeviceAction } from "./GetCustomLockScreenInfoDeviceAction";
import { type GetCustomLockScreenInfoDAState } from "./types";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    GoToDashboardDeviceAction: vi.fn(),
  };
});

describe("GetCustomLockScreenInfoDeviceAction", () => {
  const { sendCommand: sendCommandMock } = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("success cases", () => {
    it("should return HasCustomLockScreen when image exists", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        // Get image size - success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 12345 }),
        );
        // Get image hash - success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { hash: "abcdef123456" } }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: {
              hasCustomLockScreen: true,
              sizeBytes: 12345,
              hash: "abcdef123456",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return NoCustomLockScreen when GetImageSize returns no image (662e)", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        // Get image size - returns error (no image on device)
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackgroundImageCommandError({
              message: "No background image loaded on device",
              errorCode: CLS_ERROR_NO_BACKGROUND_IMAGE,
            }),
          }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: { hasCustomLockScreen: false },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return NoCustomLockScreen when GetImageSize returns 0 (and not call GetImageHash)", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        // Get image size - returns 0 (no image on device)
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 0 }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: { hasCustomLockScreen: false },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: () => {
              // Verify sendCommand was only called once (for GetImageSize, not GetImageHash)
              expect(sendCommandMock).toHaveBeenCalledTimes(1);
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("should return NoCustomLockScreen when GetImageHash returns no image (662e)", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        // Get image size - success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 12345 }),
        );
        // Get image hash - returns error (no image on device)
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackgroundImageCommandError({
              message: "No background image loaded on device",
              errorCode: CLS_ERROR_NO_BACKGROUND_IMAGE,
            }),
          }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: { hasCustomLockScreen: false },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should pass unlockTimeout to GoToDashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: { unlockTimeout: 5000 },
          });

        // Get image size - success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 100 }),
        );
        // Get image hash - success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { hash: "hash123" } }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: {
              hasCustomLockScreen: true,
              sizeBytes: 100,
              hash: "hash123",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });

  describe("error cases", () => {
    it("should return an error if GoToDashboard fails", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock(true);
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new UnknownDAError("GoToDashboard failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return DeviceInRecoveryModeDAError when GetImageSize returns 662f", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        // Get image size - returns error (recovery mode)
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackgroundImageCommandError({
              message: "Device is in recovery mode",
              errorCode: CLS_ERROR_RECOVERY_MODE,
            }),
          }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new DeviceInRecoveryModeDAError(expect.anything()),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return DeviceInRecoveryModeDAError when GetImageHash returns 662f", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        // Get image size - success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 100 }),
        );
        // Get image hash - returns error (recovery mode)
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackgroundImageCommandError({
              message: "Device is in recovery mode",
              errorCode: CLS_ERROR_RECOVERY_MODE,
            }),
          }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new DeviceInRecoveryModeDAError(expect.anything()),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return an error if GetImageSize fails with unexpected error code", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        // Get image size - returns unexpected error
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackgroundImageCommandError({
              message: "Unknown error",
              errorCode: "9999",
            }),
          }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new UnknownDAError("CLS command error: 9999"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return an error if GetImageHash fails with unexpected error code", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const getCustomLockScreenInfoDeviceAction =
          new GetCustomLockScreenInfoDeviceAction({
            input: {},
          });

        // Get image size - success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 100 }),
        );
        // Get image hash - returns unexpected error
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackgroundImageCommandError({
              message: "Unknown error",
              errorCode: "9999",
            }),
          }),
        );

        const expectedStates: Array<GetCustomLockScreenInfoDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new UnknownDAError("CLS command error: 9999"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          getCustomLockScreenInfoDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });
});
