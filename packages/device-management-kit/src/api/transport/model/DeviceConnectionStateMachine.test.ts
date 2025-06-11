import { Left, Right } from "purify-ts/Either";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApduResponse } from "@api/device-session/ApduResponse";

import { type SendApduResult } from "./DeviceConnection";
import { DeviceConnectionStateMachine } from "./DeviceConnectionStateMachine";
import {
  AlreadySendingApduError,
  DeviceDisconnectedWhileSendingError,
} from "./Errors";

describe("DeviceConnectionStateMachine", () => {
  let machine: DeviceConnectionStateMachine<void>;
  const mockApduSender = {
    sendApdu: vi.fn(),
    getDependencies: vi.fn(),
    setDependencies: vi.fn(),
    closeConnection: vi.fn(),
    setupConnection: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    machine = new DeviceConnectionStateMachine<void>({
      deviceId: "deviceId",
      deviceApduSender: mockApduSender,
      timeoutDuration: 1000,
      tryToReconnect: vi.fn(),
      onTerminated: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Send APDUs", () => {
    it("should send APDU successfully", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const result = await machine.sendApdu(apdu);

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(Right(apduResponse));
    });

    it("should send several APDUs successfully", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apdu2 = Uint8Array.from([9, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const result = await machine.sendApdu(apdu);
      const result2 = await machine.sendApdu(apdu2);

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(2);
      expect(result).toStrictEqual(Right(apduResponse));
      expect(result2).toStrictEqual(Right(apduResponse));
    });

    it("should not send several APDUs in parallel", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apdu2 = Uint8Array.from([9, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const promise = machine.sendApdu(apdu);
      const result2 = await machine.sendApdu(apdu2);
      const result = await promise;

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(Right(apduResponse));
      expect(result2).toStrictEqual(Left(new AlreadySendingApduError()));
    });

    it("Disconnected while sending APDU", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const promise = machine.sendApdu(apdu);
      machine.eventDeviceDisconnected();
      const result = await promise;

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(
        Left(new DeviceDisconnectedWhileSendingError()),
      );
    });

    it("Request disconnection while sending APDU", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const promise = machine.sendApdu(apdu);
      machine.closeConnection();
      const result = await promise;

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(
        Left(new DeviceDisconnectedWhileSendingError()),
      );
    });
  });

  describe("Send APDUs triggering disconnection", () => {
    it("should send one APDU successfully", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const result = await machine.sendApdu(apdu, true);

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(2);
      expect(mockApduSender.sendApdu.mock.calls).toEqual([
        [apdu, false, undefined],
        [Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]), false, undefined], // GetAppAndVersion APDU sent after a successful result from an APDU that triggers disconnection
      ]);
      expect(result).toStrictEqual(Right(apduResponse));
    });

    it("should send several APDUs successfully", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apdu2 = Uint8Array.from([9, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const promise1 = machine.sendApdu(apdu, true);
      await Promise.resolve(); // Allow the first APDU to be sent and processed before the disconnection event
      machine.eventDeviceDisconnected();
      machine.eventDeviceConnected();
      const promise2 = machine.sendApdu(apdu2);
      const result1 = await promise1;
      const result2 = await promise2;

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(3);
      expect(mockApduSender.sendApdu.mock.calls).toEqual([
        [apdu, false, undefined],
        [Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]), false, undefined], // GetAppAndVersion APDU sent after a successful result from an APDU that triggers disconnection
        [apdu2, false, undefined],
      ]);

      expect(result1).toStrictEqual(Right(apduResponse));
      expect(result2).toStrictEqual(Right(apduResponse));
    });

    it("should send a second APDU after reconnection", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apdu2 = Uint8Array.from([9, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const result = await machine.sendApdu(apdu, true);
      machine.eventDeviceDisconnected();
      machine.eventDeviceConnected();
      const result2 = await machine.sendApdu(apdu2);

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(3);
      expect(mockApduSender.sendApdu.mock.calls).toEqual([
        [apdu, false, undefined],
        [Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]), false, undefined], // GetAppAndVersion APDU sent after a successful result from an APDU that triggers disconnection
        [apdu2, false, undefined],
      ]);
      expect(result).toStrictEqual(Right(apduResponse));
      expect(result2).toStrictEqual(Right(apduResponse));
    });

    it("should not send several APDUs in parallel", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apdu2 = Uint8Array.from([9, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      const promise = machine.sendApdu(apdu, true);
      const result2 = await machine.sendApdu(apdu2);
      const result = await promise;

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(2);
      expect(mockApduSender.sendApdu.mock.calls).toEqual([
        [apdu, false, undefined],
        [Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]), false, undefined], // GetAppAndVersion APDU sent after a successful result from an APDU that triggers disconnection
      ]);
      expect(result).toStrictEqual(Right(apduResponse));
      expect(result2).toStrictEqual(Left(new AlreadySendingApduError()));
    });

    it("should send another APDU in promise handler", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apdu2 = Uint8Array.from([9, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      let promise: Promise<SendApduResult> | undefined = undefined;
      const result = await machine.sendApdu(apdu, true).then((value) => {
        promise = machine.sendApdu(apdu2);
        return value;
      });
      machine.eventDeviceDisconnected();
      machine.eventDeviceConnected();
      const result2 = await promise!;

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(3);
      expect(mockApduSender.sendApdu.mock.calls).toEqual([
        [apdu, false, undefined],
        [Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]), false, undefined], // GetAppAndVersion APDU sent after a successful result from an APDU that triggers disconnection
        [apdu2, false, undefined],
      ]);
      expect(result).toStrictEqual(Right(apduResponse));
      expect(result2).toStrictEqual(Right(apduResponse));
    });

    it("send an APDU while device is reconnecting", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      machine.eventDeviceDisconnected();
      const promise = machine.sendApdu(apdu, true);
      machine.eventDeviceConnected();
      const result = await promise;

      // THEN
      expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(2);
      expect(mockApduSender.sendApdu.mock.calls).toEqual([
        [apdu, false, undefined],
        [Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]), false, undefined], // GetAppAndVersion APDU sent after a successful result from an APDU that triggers disconnection
      ]);
      expect(result).toStrictEqual(Right(apduResponse));
    });

    it("Close while an APDU is waiting for reconnection", async () => {
      // GIVEN
      const apdu = Uint8Array.from([1, 2, 3, 4]);
      const apdu2 = Uint8Array.from([9, 2, 3, 4]);
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      mockApduSender.sendApdu.mockResolvedValue(Right(apduResponse));

      // WHEN
      let promise: Promise<SendApduResult> | undefined = undefined;
      const promise1 = machine.sendApdu(apdu, true);
      await Promise.resolve(); // Allow the first APDU promise to resolve before triggering disconnection
      machine.eventDeviceDisconnected();
      const result1 = await promise1;
      promise = machine.sendApdu(apdu2);
      machine.closeConnection();
      const result2 = await promise!;

      // THEN
      // expect(mockApduSender.sendApdu).toHaveBeenCalledTimes(2);
      expect(mockApduSender.sendApdu.mock.calls).toEqual([
        [apdu, false, undefined],
        [Uint8Array.from([0xb0, 0x01, 0x00, 0x00, 0x00]), false, undefined], // GetAppAndVersion APDU sent after a successful result from an APDU that triggers disconnection
      ]);
      expect(result1).toStrictEqual(Right(apduResponse));
      expect(result2).toStrictEqual(
        Left(new DeviceDisconnectedWhileSendingError()),
      );
    });
  });
});
