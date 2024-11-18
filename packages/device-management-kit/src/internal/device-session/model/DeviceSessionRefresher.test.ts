import { Left, Right } from "purify-ts";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import {
  GetAppAndVersionCommand,
  type GetAppAndVersionResponse,
} from "@api/command/os/GetAppAndVersionCommand";
import {
  GetOsVersionCommand,
  type GetOsVersionResponse,
} from "@api/command/os/GetOsVersionCommand";
import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { DEVICE_SESSION_REFRESH_INTERVAL } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { DeviceSessionRefresher } from "./DeviceSessionRefresher";

const mockSendApduFn = jest
  .fn()
  .mockResolvedValue(Promise.resolve(Right({} as ApduResponse)));
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
    jest
      .spyOn(GetOsVersionCommand.prototype, "parseResponse")
      .mockReturnValueOnce(
        CommandResultFactory({
          data: {} as GetOsVersionResponse,
        }),
      );
    logger = new DefaultLoggerPublisherService(
      [],
      "DeviceSessionRefresherTest",
    );
  });

  describe("With a modern device", () => {
    beforeEach(() => {
      const deviceIds = Object.values(DeviceModelId).filter(
        (id) => id !== DeviceModelId.NANO_S,
      );
      deviceSessionRefresher = new DeviceSessionRefresher(
        {
          refreshInterval: DEVICE_SESSION_REFRESH_INTERVAL,
          deviceStatus: DeviceStatus.CONNECTED,
          sendApduFn: mockSendApduFn,
          updateStateFn: mockUpdateStateFn,
          deviceModelId:
            deviceIds[Math.floor(Math.random() * deviceIds.length)]!,
        },
        logger,
      );
    });

    afterEach(() => {
      deviceSessionRefresher.stop();
      jest.clearAllMocks();
    });

    it("should poll by calling sendApduFn 2 times", () => {
      jest.advanceTimersByTime(DEVICE_SESSION_REFRESH_INTERVAL * 2);
      expect(mockSendApduFn).toHaveBeenCalledTimes(2);
    });

    it("should not poll when device is busy", () => {
      deviceSessionRefresher.setDeviceStatus(DeviceStatus.BUSY);

      jest.advanceTimersByTime(DEVICE_SESSION_REFRESH_INTERVAL);

      expect(mockSendApduFn).not.toHaveBeenCalled();
    });

    it("should not poll when device is disconnected", () => {
      deviceSessionRefresher.setDeviceStatus(DeviceStatus.NOT_CONNECTED);

      jest.advanceTimersByTime(DEVICE_SESSION_REFRESH_INTERVAL);

      expect(mockSendApduFn).not.toHaveBeenCalled();
    });

    it("should update device session state by calling updateStateFn", async () => {
      jest.advanceTimersByTime(DEVICE_SESSION_REFRESH_INTERVAL);

      await expect(mockSendApduFn()).resolves.toEqual(Right({}));
      expect(mockSendApduFn).toHaveBeenCalled();
      expect(mockUpdateStateFn).toHaveBeenCalled();
    });

    it("should not update device session state with failed polling response", async () => {
      mockSendApduFn.mockResolvedValueOnce(Promise.resolve(Left("error")));
      const spy = jest.spyOn(logger, "error");

      jest.advanceTimersByTime(DEVICE_SESSION_REFRESH_INTERVAL);
      await mockSendApduFn();

      await expect(mockUpdateStateFn).not.toHaveBeenCalled();
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

  describe("With a NanoS device", () => {
    afterEach(() => {
      deviceSessionRefresher.stop();
      jest.clearAllMocks();
    });

    it("should call sendApduFn 2 times and update state 1 time for a single interval", async () => {
      deviceSessionRefresher = new DeviceSessionRefresher(
        {
          refreshInterval: DEVICE_SESSION_REFRESH_INTERVAL,
          deviceStatus: DeviceStatus.CONNECTED,
          sendApduFn: mockSendApduFn,
          updateStateFn: mockUpdateStateFn,
          deviceModelId: DeviceModelId.NANO_S,
        },
        logger,
      );
      jest.advanceTimersByTime(DEVICE_SESSION_REFRESH_INTERVAL * 2 + 100);

      await Promise.resolve();
      expect(mockSendApduFn).toHaveBeenNthCalledWith(
        1,
        new GetAppAndVersionCommand().getApdu().getRawApdu(),
      );
      await Promise.resolve();
      expect(mockSendApduFn).toHaveBeenLastCalledWith(
        new GetOsVersionCommand().getApdu().getRawApdu(),
      );
      await Promise.resolve();
      expect(mockSendApduFn).toHaveBeenCalledTimes(2);
      await Promise.resolve();
      expect(mockUpdateStateFn).toHaveBeenCalledTimes(1);
    });

    it("should set device locked when get os version times out", async () => {
      mockSendApduFn.mockImplementation((apdu) => {
        if (
          apdu.toString() ===
          new GetOsVersionCommand().getApdu().getRawApdu().toString()
        ) {
          return new Promise((resolve) =>
            setTimeout(
              () => resolve(Left("timeout")),
              DEVICE_SESSION_REFRESH_INTERVAL * 10,
            ),
          );
        }
        return Promise.resolve(Right({}));
      });
      mockUpdateStateFn.mockImplementation(
        (getState: () => DeviceSessionState) => {
          deviceSessionRefresher.setDeviceStatus(getState().deviceStatus);
        },
      );
      deviceSessionRefresher = new DeviceSessionRefresher(
        {
          refreshInterval: DEVICE_SESSION_REFRESH_INTERVAL,
          deviceStatus: DeviceStatus.CONNECTED,
          sendApduFn: mockSendApduFn,
          updateStateFn: mockUpdateStateFn,
          deviceModelId: DeviceModelId.NANO_S,
        },
        logger,
      );
      jest.spyOn(deviceSessionRefresher, "setDeviceStatus");
      jest.advanceTimersByTime(DEVICE_SESSION_REFRESH_INTERVAL * 5 + 100);
      await Promise.resolve();
      expect(mockSendApduFn).toHaveBeenNthCalledWith(
        1,
        new GetAppAndVersionCommand().getApdu().getRawApdu(),
      );
      await Promise.resolve();
      expect(deviceSessionRefresher.setDeviceStatus).toHaveBeenCalledWith(
        DeviceStatus.LOCKED,
      );
    });
  });
});
