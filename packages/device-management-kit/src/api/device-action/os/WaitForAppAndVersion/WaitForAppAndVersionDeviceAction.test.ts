import { of, throwError } from "rxjs";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import {
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@api/command/utils/GlobalCommandError";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";

import {
  type WaitForAppAndVersionDAState,
  waitForAppAndVersionDAStateStep,
} from "./types";
import { WaitForAppAndVersionDeviceAction } from "./WaitForAppAndVersionDeviceAction";

const appAndVersionResult = (name: string, version: string) =>
  CommandResultFactory({
    data: {
      name,
      version,
    },
  });

const lockedErrorResult = () =>
  CommandResultFactory({
    error: new GlobalCommandError({
      ...GLOBAL_ERRORS["5515"],
      errorCode: "5515",
    }),
  });

const claNotSupportedErrorResult = () =>
  CommandResultFactory({
    error: new GlobalCommandError({
      ...GLOBAL_ERRORS["6e00"],
      errorCode: "6e00",
    }),
  });

const getAppAndVersionPendingState = (): WaitForAppAndVersionDAState => ({
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step: waitForAppAndVersionDAStateStep.GET_APP_AND_VERSION,
  },
  status: DeviceActionStatus.Pending,
});

const unlockRequestedPendingState = (): WaitForAppAndVersionDAState => ({
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.UnlockDevice,
    step: waitForAppAndVersionDAStateStep.UNLOCK_DEVICE,
  },
  status: DeviceActionStatus.Pending,
});

describe("WaitForAppAndVersionDeviceAction", () => {
  const getAppAndVersionMock = vi.fn();
  const waitForDeviceUnlockMock = vi.fn();

  function extractDependenciesMock() {
    return {
      getAppAndVersion: getAppAndVersionMock,
      waitForDeviceUnlock: waitForDeviceUnlockMock,
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should succeed on the first call when the device is already unlocked", () =>
    new Promise<void>((resolve, reject) => {
      getAppAndVersionMock.mockResolvedValue(
        appAndVersionResult("BOLOS", "1.0.0"),
      );

      const deviceAction = new WaitForAppAndVersionDeviceAction({
        input: { unlockTimeout: 500 },
      });

      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );

      const expectedStates: Array<WaitForAppAndVersionDAState> = [
        getAppAndVersionPendingState(),
        {
          status: DeviceActionStatus.Completed,
          output: {
            name: "BOLOS",
            version: "1.0.0",
          },
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should wait for the device to be unlocked then succeed", () =>
    new Promise<void>((resolve, reject) => {
      getAppAndVersionMock
        .mockResolvedValueOnce(lockedErrorResult())
        .mockResolvedValueOnce(appAndVersionResult("Bitcoin", "2.1.0"));

      waitForDeviceUnlockMock.mockReturnValue(of(undefined));

      const deviceAction = new WaitForAppAndVersionDeviceAction({
        input: { unlockTimeout: 500 },
      });

      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );

      const expectedStates: Array<WaitForAppAndVersionDAState> = [
        getAppAndVersionPendingState(),
        unlockRequestedPendingState(),
        getAppAndVersionPendingState(),
        {
          status: DeviceActionStatus.Completed,
          output: {
            name: "Bitcoin",
            version: "2.1.0",
          },
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should consider the device on the dashboard of an old firmware when CLA is not supported", () =>
    new Promise<void>((resolve, reject) => {
      getAppAndVersionMock.mockResolvedValue(claNotSupportedErrorResult());

      const deviceAction = new WaitForAppAndVersionDeviceAction({
        input: { unlockTimeout: 500 },
      });

      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );

      const expectedStates: Array<WaitForAppAndVersionDAState> = [
        getAppAndVersionPendingState(),
        {
          status: DeviceActionStatus.Completed,
          output: {
            name: "BOLOS",
            version: "0.0.0",
          },
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should end in an error if the device stays locked until the unlock timeout", () =>
    new Promise<void>((resolve, reject) => {
      getAppAndVersionMock.mockResolvedValue(lockedErrorResult());

      waitForDeviceUnlockMock.mockReturnValue(
        throwError(() => new DeviceLockedError()),
      );

      const deviceAction = new WaitForAppAndVersionDeviceAction({
        input: { unlockTimeout: 500 },
      });

      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );

      const expectedStates: Array<WaitForAppAndVersionDAState> = [
        getAppAndVersionPendingState(),
        unlockRequestedPendingState(),
        {
          status: DeviceActionStatus.Error,
          error: new DeviceLockedError(),
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should end in an error if the GetAppAndVersion command fails with a non-locked error", () =>
    new Promise<void>((resolve, reject) => {
      const error = new GlobalCommandError({
        ...GLOBAL_ERRORS["5501"],
        errorCode: "5501",
      });

      getAppAndVersionMock.mockResolvedValue(CommandResultFactory({ error }));

      const deviceAction = new WaitForAppAndVersionDeviceAction({
        input: { unlockTimeout: 500 },
      });

      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );

      const expectedStates: Array<WaitForAppAndVersionDAState> = [
        getAppAndVersionPendingState(),
        {
          status: DeviceActionStatus.Error,
          error,
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should end in an error if the getAppAndVersion actor throws an error", () =>
    new Promise<void>((resolve, reject) => {
      getAppAndVersionMock.mockImplementation(() => {
        throw new UnknownDAError("error");
      });

      const deviceAction = new WaitForAppAndVersionDeviceAction({
        input: { unlockTimeout: 500 },
      });

      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );

      const expectedStates: Array<WaitForAppAndVersionDAState> = [
        getAppAndVersionPendingState(),
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError("error"),
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
});
