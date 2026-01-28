import {
  CommandResultFactory,
  DeviceActionStatus,
  GLOBAL_ERRORS,
  GlobalCommandError,
  RefusedByUserDAError,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";

import { RemoveCustomLockScreenDeviceAction } from "./RemoveCustomLockScreenDeviceAction";
import { type RemoveCustomLockScreenDAState } from "./types";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    GoToDashboardDeviceAction: vi.fn(),
  };
});

describe("RemoveCustomLockScreenDeviceAction", () => {
  const { sendCommand: sendCommandMock } = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("success cases", () => {
    it("should run the device action and remove image", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const removeCustomLockScreenDeviceAction =
          new RemoveCustomLockScreenDeviceAction({
            input: {},
          });

        // Remove image success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: undefined }),
        );

        const expectedStates: Array<RemoveCustomLockScreenDAState> = [
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
              requiredUserInteraction:
                UserInteractionRequired.ConfirmRemoveImage,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: undefined,
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          removeCustomLockScreenDeviceAction,
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
        const removeCustomLockScreenDeviceAction =
          new RemoveCustomLockScreenDeviceAction({
            input: { unlockTimeout: 5000 },
          });

        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: undefined }),
        );

        const expectedStates: Array<RemoveCustomLockScreenDAState> = [
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
              requiredUserInteraction:
                UserInteractionRequired.ConfirmRemoveImage,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: undefined,
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          removeCustomLockScreenDeviceAction,
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
        const removeCustomLockScreenDeviceAction =
          new RemoveCustomLockScreenDeviceAction({
            input: {},
          });

        const expectedStates: Array<RemoveCustomLockScreenDAState> = [
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
          removeCustomLockScreenDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return an error if RemoveImage fails with user refused", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const removeCustomLockScreenDeviceAction =
          new RemoveCustomLockScreenDeviceAction({
            input: {},
          });

        const globalError = new GlobalCommandError({
          errorCode: "5501",
          ...GLOBAL_ERRORS["5501"],
        });

        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ error: globalError }),
        );

        const expectedStates: Array<RemoveCustomLockScreenDAState> = [
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
              requiredUserInteraction:
                UserInteractionRequired.ConfirmRemoveImage,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new RefusedByUserDAError("User refused on device"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          removeCustomLockScreenDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return an error if RemoveImage fails with unexpected error code", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const removeCustomLockScreenDeviceAction =
          new RemoveCustomLockScreenDeviceAction({
            input: {},
          });

        const globalError = new GlobalCommandError({
          errorCode: "6e00",
          ...GLOBAL_ERRORS["6e00"],
        });

        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ error: globalError }),
        );

        const expectedStates: Array<RemoveCustomLockScreenDAState> = [
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
              requiredUserInteraction:
                UserInteractionRequired.ConfirmRemoveImage,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new UnknownDAError("CLS command error: 6e00"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          removeCustomLockScreenDeviceAction,
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
