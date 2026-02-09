import {
  CommandResultFactory,
  DeviceActionStatus,
  GLOBAL_ERRORS,
  GlobalCommandError,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  BackgroundImageCommandError,
  CLS_ERROR_NO_BACKGROUND_IMAGE,
} from "@api/command/BackgroundImageCommandErrors";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { NoCustomLockScreenImageDAError } from "@api/device-action/customLockScreenDeviceActionErrors";

import { DownloadCustomLockScreenDeviceAction } from "./DownloadCustomLockScreenDeviceAction";
import { type DownloadCustomLockScreenDAState } from "./types";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    GoToDashboardDeviceAction: vi.fn(),
  };
});

describe("DownloadCustomLockScreenDeviceAction", () => {
  const { sendCommand: sendCommandMock } = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("success cases", () => {
    it("should run the device action and fetch image", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const fetchCustomLockScreenDeviceAction =
          new DownloadCustomLockScreenDeviceAction({
            input: {},
          });

        // Get image hash
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { hash: "abcdef123456" } }),
        );
        // Get image size
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 5 }),
        );
        // Fetch chunk
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { data: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]) },
          }),
        );

        const expectedStates: Array<DownloadCustomLockScreenDAState> = [
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
              currentImageHash: "abcdef123456",
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              currentImageHash: "abcdef123456",
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: {
              imageData: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
              imageHash: "abcdef123456",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          fetchCustomLockScreenDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return alreadyBackedUp when hash matches backupHash", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const fetchCustomLockScreenDeviceAction =
          new DownloadCustomLockScreenDeviceAction({
            input: { backupHash: "abcdef123456" },
          });

        // Get image hash - matches backupHash
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { hash: "abcdef123456" } }),
        );

        const expectedStates: Array<DownloadCustomLockScreenDAState> = [
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
            output: { alreadyBackedUp: true },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          fetchCustomLockScreenDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should succeed with empty output when no image and allowedEmpty", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const fetchCustomLockScreenDeviceAction =
          new DownloadCustomLockScreenDeviceAction({
            input: { allowedEmpty: true },
          });

        // Get image hash - returns error (no image on device)
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackgroundImageCommandError({
              message: "No background image loaded on device",
              errorCode: CLS_ERROR_NO_BACKGROUND_IMAGE,
            }),
          }),
        );

        const expectedStates: Array<DownloadCustomLockScreenDAState> = [
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
            output: { imageData: new Uint8Array(0), imageHash: "" },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          fetchCustomLockScreenDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should succeed with empty output when image size is 0 and allowedEmpty", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const fetchCustomLockScreenDeviceAction =
          new DownloadCustomLockScreenDeviceAction({
            input: { allowedEmpty: true },
          });

        // Get image hash - succeeds
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { hash: "somehash" } }),
        );
        // Get image size - returns 0
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 0 }),
        );

        const expectedStates: Array<DownloadCustomLockScreenDAState> = [
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
              currentImageHash: "somehash",
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: { imageData: new Uint8Array(0), imageHash: "somehash" },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          fetchCustomLockScreenDeviceAction,
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
        const fetchCustomLockScreenDeviceAction =
          new DownloadCustomLockScreenDeviceAction({
            input: {},
          });

        const expectedStates: Array<DownloadCustomLockScreenDAState> = [
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
          fetchCustomLockScreenDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return an error when no image and allowedEmpty is false", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const fetchCustomLockScreenDeviceAction =
          new DownloadCustomLockScreenDeviceAction({
            input: { allowedEmpty: false },
          });

        // Get image hash - returns error (no image on device)
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackgroundImageCommandError({
              message: "No background image loaded on device",
              errorCode: CLS_ERROR_NO_BACKGROUND_IMAGE,
            }),
          }),
        );

        const expectedStates: Array<DownloadCustomLockScreenDAState> = [
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
            error: new NoCustomLockScreenImageDAError(),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          fetchCustomLockScreenDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should return an error when image size is 0 and allowedEmpty is false", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const fetchCustomLockScreenDeviceAction =
          new DownloadCustomLockScreenDeviceAction({
            input: { allowedEmpty: false },
          });

        // Get image hash - succeeds
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { hash: "somehash" } }),
        );
        // Get image size - returns 0
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: 0 }),
        );

        const expectedStates: Array<DownloadCustomLockScreenDAState> = [
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
              currentImageHash: "somehash",
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new NoCustomLockScreenImageDAError(),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          fetchCustomLockScreenDeviceAction,
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
        const fetchCustomLockScreenDeviceAction =
          new DownloadCustomLockScreenDeviceAction({
            input: {},
          });

        const globalError = new GlobalCommandError({
          errorCode: "5501",
          ...GLOBAL_ERRORS["5501"],
        });

        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ error: globalError }),
        );

        const expectedStates: Array<DownloadCustomLockScreenDAState> = [
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
            error: new UnknownDAError("CLS command error: 5501"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          fetchCustomLockScreenDeviceAction,
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
