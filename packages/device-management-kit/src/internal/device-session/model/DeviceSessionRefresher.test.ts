import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeviceModelId } from "@api/device/DeviceModel";
import { type TransportConnectedDevice } from "@api/transport/model/TransportConnectedDevice";
import type { LoggerPublisherService } from "@api/types";
import {
  DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL,
  DEVICE_SESSION_REFRESHER_POLLING_INTERVAL,
} from "@internal/device-session/data/DeviceSessionRefresherConst";
import type {
  DeviceSessionEventDispatcher,
  NewEvent,
} from "@internal/device-session/model/DeviceSessionEventDispatcher";
import { SessionEvents } from "@internal/device-session/model/DeviceSessionEventDispatcher";

import {
  DeviceSessionRefresher,
  type DeviceSessionRefresherOptions,
} from "./DeviceSessionRefresher";

describe("DeviceSessionRefresher", () => {
  let subject: Subject<NewEvent>;
  let mockSessionEventDispatcher: DeviceSessionEventDispatcher;
  let mockLogger: LoggerPublisherService & {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    subscribers?: unknown[];
  };

  const stubDefaultDevice = {
    deviceModel: {
      id: DeviceModelId.FLEX,
    },
  } as TransportConnectedDevice;

  const stubNanoSDevice = {
    deviceModel: {
      id: DeviceModelId.NANO_S,
    },
  } as TransportConnectedDevice;

  const mockedLoggerModuleFactory = vi.fn(() => mockLogger);
  let refresher: DeviceSessionRefresher;

  beforeEach(() => {
    vi.useFakeTimers();
    subject = new Subject<NewEvent>();
    mockSessionEventDispatcher = {
      listen: () => subject.asObservable(),
      dispatch: vi.fn(),
    } as unknown as DeviceSessionEventDispatcher;
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      subscribers: [],
    };
  });

  afterEach(() => {
    refresher?.stopRefresher();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should not start refresher if disabled", () => {
    const options: DeviceSessionRefresherOptions = {
      isRefresherDisabled: true,
      pollingInterval: 1000,
    };

    refresher = new DeviceSessionRefresher(
      mockedLoggerModuleFactory,
      options,
      mockSessionEventDispatcher,
      stubDefaultDevice,
    );
    refresher.startRefresher();
    vi.advanceTimersByTime(2000);

    expect(mockSessionEventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("should warn and use minimum polling interval for default device when provided interval is too low", () => {
    const lowInterval = DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL - 100;
    const options: DeviceSessionRefresherOptions = {
      isRefresherDisabled: false,
      pollingInterval: lowInterval,
    };

    refresher = new DeviceSessionRefresher(
      mockedLoggerModuleFactory,
      options,
      mockSessionEventDispatcher,
      stubDefaultDevice,
    );
    refresher.startRefresher();

    const expectedMessage = `Polling interval of ${lowInterval} is too low, setting to minimum as ${DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL}`;
    expect(mockLogger.warn).toHaveBeenCalledWith(expectedMessage);
  });

  it("should warn and use minimum polling interval for NANO_S device when provided interval is too low", () => {
    const defaultNanoPollingInterval =
      DEVICE_SESSION_REFRESHER_POLLING_INTERVAL * 2;
    const lowInterval = defaultNanoPollingInterval - 100;
    const options: DeviceSessionRefresherOptions = {
      isRefresherDisabled: false,
      pollingInterval: lowInterval,
    };

    refresher = new DeviceSessionRefresher(
      mockedLoggerModuleFactory,
      options,
      mockSessionEventDispatcher,
      stubNanoSDevice,
    );
    refresher.startRefresher();

    const expectedMessage = `Polling interval of ${lowInterval} is too low, setting to minimum as ${defaultNanoPollingInterval}`;
    expect(mockLogger.warn).toHaveBeenCalledWith(expectedMessage);
  });

  it("should not warn when provided polling interval is valid for default device", () => {
    const validInterval =
      DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL + 100;
    const options: DeviceSessionRefresherOptions = {
      isRefresherDisabled: false,
      pollingInterval: validInterval,
    };

    refresher = new DeviceSessionRefresher(
      mockedLoggerModuleFactory,
      options,
      mockSessionEventDispatcher,
      stubDefaultDevice,
    );
    refresher.startRefresher();

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("should dispatch refresh event on timer ticks", () => {
    const validInterval =
      DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL + 100;
    const options: DeviceSessionRefresherOptions = {
      isRefresherDisabled: false,
      pollingInterval: validInterval,
    };

    refresher = new DeviceSessionRefresher(
      mockedLoggerModuleFactory,
      options,
      mockSessionEventDispatcher,
      stubDefaultDevice,
    );
    refresher.startRefresher();

    // Trigger NEW_STATE event to start the refresher timer
    subject.next({ eventName: SessionEvents.NEW_STATE });

    const timerInterval = validInterval * 2;

    vi.advanceTimersByTime(timerInterval * 3);

    expect(
      (mockSessionEventDispatcher.dispatch as ReturnType<typeof vi.fn>).mock
        .calls.length,
    ).toBe(4);
    expect(
      (mockSessionEventDispatcher.dispatch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0],
    ).toEqual({
      eventName: SessionEvents.REFRESH_NEEDED,
    });
  });

  it("should stop refresher", () => {
    const options: DeviceSessionRefresherOptions = {
      isRefresherDisabled: false,
      pollingInterval: 1000,
    };
    refresher = new DeviceSessionRefresher(
      mockedLoggerModuleFactory,
      options,
      mockSessionEventDispatcher,
      stubDefaultDevice,
    );
    refresher.startRefresher();
    (
      mockSessionEventDispatcher.dispatch as ReturnType<typeof vi.fn>
    ).mockClear();

    refresher.stopRefresher();
    vi.advanceTimersByTime(2000);

    expect(mockSessionEventDispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("Refresher stopped.");
  });

  it("should restart refresher", () => {
    const options: DeviceSessionRefresherOptions = {
      isRefresherDisabled: false,
      pollingInterval: 1000,
    };
    refresher = new DeviceSessionRefresher(
      mockedLoggerModuleFactory,
      options,
      mockSessionEventDispatcher,
      stubDefaultDevice,
    );
    refresher.startRefresher();
    (
      mockSessionEventDispatcher.dispatch as ReturnType<typeof vi.fn>
    ).mockClear();
    vi.clearAllTimers();

    refresher.restartRefresher();
    expect(mockLogger.info).toHaveBeenCalledWith("Refresher stopped.");
    expect(mockLogger.info).toHaveBeenCalledWith("Refresher restarted.");

    // Trigger NEW_STATE event to start the refresher timer
    subject.next({ eventName: SessionEvents.NEW_STATE });

    vi.advanceTimersByTime(2000);
    expect(
      (mockSessionEventDispatcher.dispatch as ReturnType<typeof vi.fn>).mock
        .calls.length,
    ).toBeGreaterThan(0);
  });
});
