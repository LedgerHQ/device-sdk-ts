import { BehaviorSubject, Subject } from "rxjs";
import { expect, type Mock } from "vitest";

import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";
import {
  CommandResultStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@api/index";
import {
  type DeviceSessionEventDispatcher,
  type NewEvent,
  SessionEvents,
} from "@internal/device-session/model/DeviceSessionEventDispatcher";

import {
  DeviceSessionStateHandler,
  type SetDeviceSessionStateFn,
} from "./DeviceSessionStateHandler";

describe("DeviceSessionStateHandler", () => {
  let fakeEventSubject: Subject<NewEvent>;
  let fakeSessionEventDispatcher: DeviceSessionEventDispatcher;
  let mockLogger: {
    error: (message: string, meta?: Record<string, unknown>) => void;
    debug: (message: string, meta?: Record<string, unknown>) => void;
  };
  const mockLoggerModuleFactory = vi.fn(() => mockLogger);
  let fakeConnectedDevice: { deviceModel: { id: string } };
  let deviceState: BehaviorSubject<DeviceSessionState>;
  let setDeviceSessionState: Mock<SetDeviceSessionStateFn>;
  let handler: DeviceSessionStateHandler;

  beforeEach(() => {
    fakeEventSubject = new Subject<NewEvent>();
    //@ts-expect-error mock
    fakeSessionEventDispatcher = {
      listen: () => fakeEventSubject,
      dispatch: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
      debug: vi.fn(),
    };

    fakeConnectedDevice = {
      deviceModel: {
        id: "device-model-1",
      },
    };

    deviceState = new BehaviorSubject<DeviceSessionState>({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      deviceModelId: DeviceModelId.NANO_X,
      currentApp: { name: "", version: "" },
      installedApps: [],
      isSecureConnectionAllowed: false,
    });

    setDeviceSessionState = vi.fn();

    handler = new DeviceSessionStateHandler(
      //@ts-expect-error mock
      mockLoggerModuleFactory,
      fakeSessionEventDispatcher,
      fakeConnectedDevice,
      deviceState,
      setDeviceSessionState,
    );
  });

  afterEach(() => {
    if (handler && typeof handler.unsubscribe === "function") {
      handler.unsubscribe();
    }
  });

  it("updates device state on COMMAND_SUCCEEDED event with a successful response", () => {
    // Given
    const fakeCommandResult = {
      data: {
        name: "TestApp",
        version: "1.0.0",
      },
      status: CommandResultStatus.Success,
    };

    // When
    fakeEventSubject.next({
      eventName: SessionEvents.COMMAND_SUCCEEDED,
      //@ts-expect-error mock
      eventData: fakeCommandResult,
    });

    // Then
    expect(setDeviceSessionState).toHaveBeenCalledWith({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      deviceModelId: "device-model-1",
      currentApp: { name: "TestApp", version: "1.0.0" },
      installedApps: [],
      isSecureConnectionAllowed: false,
    });
  });

  it("updates device state on DEVICE_STATE_UPDATE_BUSY event", () => {
    // When
    fakeEventSubject.next({
      eventName: SessionEvents.DEVICE_STATE_UPDATE_BUSY,
    });

    // Then
    expect(setDeviceSessionState).toHaveBeenCalledWith(
      expect.objectContaining({ deviceStatus: DeviceStatus.BUSY }),
    );
  });

  it("updates device state on DEVICE_STATE_UPDATE_CONNECTED event", () => {
    // When
    fakeEventSubject.next({
      eventName: SessionEvents.DEVICE_STATE_UPDATE_CONNECTED,
    });

    // Then
    expect(setDeviceSessionState).toHaveBeenCalledWith(
      expect.objectContaining({ deviceStatus: DeviceStatus.CONNECTED }),
    );
  });

  it("logs error and does not update state if command result is unsuccessful", () => {
    // Given
    const fakeErrorCommandResult = {
      data: null,
      error: { _tag: "SomeOtherError" },
    };

    // When
    fakeEventSubject.next({
      eventName: SessionEvents.COMMAND_SUCCEEDED,
      //@ts-expect-error mock
      eventData: fakeErrorCommandResult,
    });

    // Then
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "Error while parsing APDU response",
      { data: { parsedResponse: fakeErrorCommandResult } },
    );
    expect(setDeviceSessionState).not.toHaveBeenCalled();
  });

  it("does not update state if command result is not a success", () => {
    // Given
    const fakeErrorCommandResult = {
      data: null,
      error: { _tag: "SomeOtherError" },
    };

    // When
    fakeEventSubject.next({
      eventName: SessionEvents.COMMAND_SUCCEEDED,
      //@ts-expect-error mock
      eventData: fakeErrorCommandResult,
    });

    // Then
    expect(setDeviceSessionState).not.toHaveBeenCalled();
  });
});
