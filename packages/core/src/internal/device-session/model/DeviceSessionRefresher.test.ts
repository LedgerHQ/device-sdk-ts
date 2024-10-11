import { Left, Right } from "purify-ts";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import {
  GetAppAndVersionCommand,
  GetAppAndVersionResponse,
} from "@api/command/os/GetAppAndVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { DeviceSessionRefresher } from "./DeviceSessionRefresher";

const mockSendApduFn = jest.fn().mockResolvedValue(Right({} as ApduResponse));
const mockUpdateStateFn = jest.fn().mockImplementation(() => undefined);

jest.useFakeTimers();

describe("DeviceSessionRefresher", () => {
  let deviceSessionRefresher: DeviceSessionRefresher;
  let logger: LoggerPublisherService;

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
    deviceSessionRefresher = new DeviceSessionRefresher(
      {
        refreshInterval: 1000,
        deviceStatus: DeviceStatus.CONNECTED,
        sendApduFn: mockSendApduFn,
        updateStateFn: mockUpdateStateFn,
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
    deviceSessionRefresher.setDeviceStatus(DeviceStatus.BUSY);

    jest.advanceTimersByTime(1000);

    expect(mockSendApduFn).not.toHaveBeenCalled();
  });

  it("should not poll when device is disconnected", () => {
    deviceSessionRefresher.setDeviceStatus(DeviceStatus.NOT_CONNECTED);

    jest.advanceTimersByTime(1000);

    expect(mockSendApduFn).not.toHaveBeenCalled();
  });

  it("should update device session state by calling updateStateFn", async () => {
    jest.advanceTimersByTime(1000);

    expect(await mockSendApduFn()).toEqual(Right({}));
    expect(mockUpdateStateFn).toHaveBeenCalled();
  });

  it("should not update device session state with failed polling response", async () => {
    mockSendApduFn.mockResolvedValueOnce(Left("error"));
    const spy = jest.spyOn(logger, "error");

    jest.advanceTimersByTime(1000);
    await mockSendApduFn();

    expect(mockUpdateStateFn).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it("should stop the refresher when device is disconnected", () => {
    const spy = jest.spyOn(deviceSessionRefresher, "stop");
    deviceSessionRefresher.setDeviceStatus(DeviceStatus.NOT_CONNECTED);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("should not throw error if stop is called on a stopped refresher", () => {
    deviceSessionRefresher.stop();
    expect(() => deviceSessionRefresher.stop()).not.toThrow();
  });
});
