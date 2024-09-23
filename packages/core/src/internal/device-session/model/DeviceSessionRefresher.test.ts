import { Left, Right } from "purify-ts";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import {
  GetAppAndVersionCommand,
  GetAppAndVersionResponse,
} from "@api/command/os/GetAppAndVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { DefaultEventDispatcher } from "@internal/event-dispatcher/service/DefaultEventDispatcher";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { DeviceSessionRefresher } from "./DeviceSessionRefresher";

jest.mock<DefaultEventDispatcher<DeviceSessionState>>(
  "@internal/event-dispatcher/service/DefaultEventDispatcher",
);
jest.useFakeTimers();

const mockSendApduFn = jest.fn().mockResolvedValue(Right({} as ApduResponse));

describe("DeviceSessionRefresher", () => {
  let deviceSessionRefresher: DeviceSessionRefresher;
  let logger: LoggerPublisherService;
  let deviceState: DefaultEventDispatcher<DeviceSessionState>;

  beforeEach(() => {
    jest
      .spyOn(GetAppAndVersionCommand.prototype, "parseResponse")
      .mockReturnValueOnce(
        CommandResultFactory({
          data: {
            name: "testAppName",
          } as GetAppAndVersionResponse,
        }),
      );

    logger = new DefaultLoggerPublisherService(
      [],
      "DeviceSessionRefresherTest",
    );

    deviceState = new DefaultEventDispatcher<DeviceSessionState>({
      deviceStatus: DeviceStatus.CONNECTED,
    } as DeviceSessionState);

    jest.spyOn(deviceState, "get").mockReturnValue({
      deviceStatus: DeviceStatus.CONNECTED,
    } as DeviceSessionState);

    deviceSessionRefresher = new DeviceSessionRefresher(
      {
        refreshInterval: 1000,
        deviceState,
        sendApduFn: mockSendApduFn,
      },
      logger,
    );
  });

  afterEach(() => {
    deviceSessionRefresher.stop();
    jest.clearAllMocks();
  });

  it("should poll by calling sendApduFn", () => {
    jest.advanceTimersByTime(1000);
    expect(mockSendApduFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(mockSendApduFn).toHaveBeenCalledTimes(2);
  });

  it("should not poll when device is busy", () => {
    jest.spyOn(deviceState, "get").mockReturnValue({
      deviceStatus: DeviceStatus.BUSY,
    } as DeviceSessionState);

    jest.advanceTimersByTime(1000);

    expect(mockSendApduFn).not.toHaveBeenCalled();
  });

  it("should not poll when device is disconnected", () => {
    jest.spyOn(deviceState, "get").mockReturnValue({
      deviceStatus: DeviceStatus.NOT_CONNECTED,
    } as DeviceSessionState);

    jest.advanceTimersByTime(1000);

    expect(mockSendApduFn).not.toHaveBeenCalled();
  });

  it("should update device session state by calling updateStateFn", async () => {
    jest.advanceTimersByTime(1000);

    expect(await mockSendApduFn()).toEqual(Right({}));
    expect(deviceState.dispatch).toHaveBeenCalled();
  });

  it("should not update device session state with failed polling response", async () => {
    mockSendApduFn.mockResolvedValueOnce(Left("error"));
    const spy = jest.spyOn(logger, "error");

    jest.advanceTimersByTime(1000);
    await mockSendApduFn();

    expect(deviceState.dispatch).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it("should not throw error if stop is called on a stopped refresher", () => {
    deviceSessionRefresher.stop();
    expect(() => deviceSessionRefresher.stop()).not.toThrow();
  });
});
