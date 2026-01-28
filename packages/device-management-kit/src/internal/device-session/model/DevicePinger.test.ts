import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeviceModelId } from "@api/device/DeviceModel";
import {
  GetAppAndVersionCommand,
  type TransportConnectedDevice,
} from "@api/index";
import type { LoggerPublisherService } from "@api/types";
import { DEVICE_SESSION_REFRESHER_POLLING_INTERVAL } from "@internal/device-session/data/DeviceSessionRefresherConst";
import {
  type DeviceSessionEventDispatcher,
  type NewEvent,
  SessionEvents,
} from "@internal/device-session/model/DeviceSessionEventDispatcher";

import { DevicePinger } from "./DevicePinger";

describe("DevicePinger", () => {
  let dummySendCommandFunction: ReturnType<typeof vi.fn>;
  let mockLogger: LoggerPublisherService & {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  const mockedLoggerModuleFactory = vi.fn(() => mockLogger);
  let eventSubject: Subject<NewEvent>;
  let mockSessionEventDispatcher: DeviceSessionEventDispatcher;
  let dummyConnectedDevice: TransportConnectedDevice;
  let devicePinger: DevicePinger;

  beforeEach(() => {
    eventSubject = new Subject<NewEvent>();
    mockSessionEventDispatcher = {
      listen: () => eventSubject.asObservable(),
      dispatch: vi.fn(),
    } as unknown as DeviceSessionEventDispatcher;

    dummySendCommandFunction = vi.fn();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      subscribers: [],
    };

    dummyConnectedDevice = {
      deviceModel: {
        id: DeviceModelId.NANO_X,
      },
    } as unknown as TransportConnectedDevice;

    devicePinger = new DevicePinger(
      mockedLoggerModuleFactory,
      dummyConnectedDevice,
      mockSessionEventDispatcher,
      dummySendCommandFunction,
    );
  });

  afterEach(() => {
    devicePinger.unsubscribe();
    vi.restoreAllMocks();
  });

  it("should call sendCommandFunction and dispatch COMMAND_SUCCEEDED event on successful ping for non-NANO_S", async () => {
    // given
    const dummyResult = {
      status: "success",
      data: { foo: "bar" },
    };
    dummySendCommandFunction.mockResolvedValue(dummyResult);

    // when
    const result = await devicePinger.ping();

    // then
    expect(dummySendCommandFunction).toHaveBeenCalledTimes(1);
    const commandArg = dummySendCommandFunction.mock
      .calls[0]![0] as GetAppAndVersionCommand;
    expect(commandArg).toBeInstanceOf(GetAppAndVersionCommand);
    expect(mockSessionEventDispatcher.dispatch).toHaveBeenCalledWith({
      eventName: SessionEvents.COMMAND_SUCCEEDED,
      eventData: dummyResult,
    });
    expect(result).toEqual(dummyResult);
  });

  it("should log error and throw error on ping failure", async () => {
    // given
    const dummyError = new Error("ping failed");
    dummySendCommandFunction.mockRejectedValue(dummyError);

    // then
    expect(await devicePinger.ping()).toBeNull();
    expect(dummySendCommandFunction).toHaveBeenCalledTimes(1);
  });

  it("should dispatch DEVICE_STATE_UPDATE_LOCKED and return null on timeout for NANO_S", async () => {
    // given
    dummyConnectedDevice.deviceModel.id = DeviceModelId.NANO_S;
    devicePinger.unsubscribe();
    devicePinger = new DevicePinger(
      mockedLoggerModuleFactory,
      dummyConnectedDevice,
      mockSessionEventDispatcher,
      dummySendCommandFunction,
    );
    const neverResolvingPromise = new Promise(() => {});
    dummySendCommandFunction.mockReturnValueOnce(neverResolvingPromise);
    vi.useFakeTimers();

    // when
    const pingPromise = devicePinger.ping();
    vi.advanceTimersByTime(DEVICE_SESSION_REFRESHER_POLLING_INTERVAL * 4);

    const result = await pingPromise;

    // then
    expect(result).toBeNull();
    expect(mockSessionEventDispatcher.dispatch).toHaveBeenCalledWith({
      eventName: SessionEvents.DEVICE_STATE_UPDATE_LOCKED,
    });
    expect(dummySendCommandFunction).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should call ping on REFRESH_NEEDED event", async () => {
    // given
    const dummyResult = {
      status: "success",
      data: { foo: "bar" },
    };
    dummySendCommandFunction.mockResolvedValue(dummyResult);

    // when
    eventSubject.next({
      eventName: SessionEvents.REFRESH_NEEDED,
      eventData: undefined,
    });
    await Promise.resolve();

    // then
    expect(dummySendCommandFunction).toHaveBeenCalled();
    expect(mockSessionEventDispatcher.dispatch).toHaveBeenCalledWith({
      eventName: SessionEvents.COMMAND_SUCCEEDED,
      eventData: dummyResult,
    });
  });

  it("should not process events after unsubscribe is called", async () => {
    // given
    devicePinger.unsubscribe();
    dummySendCommandFunction.mockClear();

    // when
    eventSubject.next({
      eventName: SessionEvents.REFRESH_NEEDED,
      eventData: undefined,
    });
    await Promise.resolve();

    // then
    expect(dummySendCommandFunction).not.toHaveBeenCalled();
  });
});
