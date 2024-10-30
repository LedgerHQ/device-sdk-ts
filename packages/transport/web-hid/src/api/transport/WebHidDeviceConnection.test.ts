import {
  type ApduReceiverService,
  type ApduSenderService,
  defaultApduReceiverServiceStubBuilder,
  defaultApduSenderServiceStubBuilder,
  type DeviceId,
  type LoggerPublisherService,
  type LoggerSubscriberService,
  ReconnectionFailedError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/WebHidConfig";
import { hidDeviceStubBuilder } from "@api/model/HIDDevice.stub";

import { WebHidDeviceConnection } from "./WebHidDeviceConnection";

jest.useFakeTimers();

const RESPONSE_LOCKED_DEVICE = new Uint8Array([
  0xaa, 0xaa, 0x05, 0x00, 0x00, 0x00, 0x02, 0x55, 0x15, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const RESPONSE_SUCCESS = new Uint8Array([
  0xaa, 0xaa, 0x05, 0x00, 0x00, 0x00, 0x02, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

class LoggerPublisherServiceStub implements LoggerPublisherService {
  tag: string;
  constructor(subscribers: LoggerSubscriberService[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }
  subscribers: LoggerSubscriberService[] = [];
  error = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
  info = jest.fn();
}

/**
 * Flushes all pending promises
 */
const flushPromises = () =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  new Promise(jest.requireActual("timers").setImmediate);

jest.useFakeTimers();

describe("WebHidDeviceConnection", () => {
  let device: HIDDevice;
  let apduSender: ApduSenderService;
  let apduReceiver: ApduReceiverService;
  const onConnectionTerminated = () => {};
  const deviceId: DeviceId = "test-device-id";
  const logger = (tag: string) => new LoggerPublisherServiceStub([], tag);

  beforeEach(() => {
    device = hidDeviceStubBuilder({ opened: true });
    apduSender = defaultApduSenderServiceStubBuilder(undefined, logger);
    apduReceiver = defaultApduReceiverServiceStubBuilder(undefined, logger);
  });

  it("should get device", () => {
    // given
    const connection = new WebHidDeviceConnection(
      { device, apduSender, apduReceiver, onConnectionTerminated, deviceId },
      logger,
    );
    // when
    const cDevice = connection.device;
    // then
    expect(cDevice).toStrictEqual(device);
  });

  it("should send APDU through hid report", () => {
    // given
    const connection = new WebHidDeviceConnection(
      { device, apduSender, apduReceiver, onConnectionTerminated, deviceId },
      logger,
    );
    // when
    connection.sendApdu(new Uint8Array(0));
    // then
    expect(device.sendReport).toHaveBeenCalled();
  });

  it("should receive APDU through hid report", async () => {
    // given
    device.sendReport = jest.fn(() =>
      Promise.resolve(
        device.oninputreport!({
          type: "inputreport",
          data: new DataView(Uint8Array.from(RESPONSE_SUCCESS).buffer),
        } as HIDInputReportEvent),
      ),
    );
    const connection = new WebHidDeviceConnection(
      { device, apduSender, apduReceiver, onConnectionTerminated, deviceId },
      logger,
    );
    // when
    const response = await connection.sendApdu(Uint8Array.from([]));
    // then
    expect(response).toEqual(
      Right({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      }),
    );
  });

  describe("anticipating loss of connection after sending an APDU", () => {
    test("sendApdu(whatever, true) should wait for reconnection before resolving if the response is a success", async () => {
      // given
      device.sendReport = jest.fn(() =>
        Promise.resolve(
          device.oninputreport!({
            type: "inputreport",
            data: new DataView(Uint8Array.from(RESPONSE_SUCCESS).buffer),
          } as HIDInputReportEvent),
        ),
      );
      const connection = new WebHidDeviceConnection(
        { device, apduSender, apduReceiver, onConnectionTerminated, deviceId },
        logger,
      );

      let hasResolved = false;
      const responsePromise = connection
        .sendApdu(Uint8Array.from([]), true)
        .then((response) => {
          hasResolved = true;
          return response;
        });

      connection.lostConnection();

      // before reconnecting
      await flushPromises();
      expect(hasResolved).toBe(false);

      // when reconnecting
      connection.reconnectHidDevice(device);
      await flushPromises();
      expect(hasResolved).toBe(true);

      const response = await responsePromise;

      expect(response).toEqual(
        Right({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array([]),
        }),
      );
    });

    test("sendApdu(whatever, true) should not wait for reconnection if the response is not a success", async () => {
      // given
      device.sendReport = jest.fn(() =>
        Promise.resolve(
          device.oninputreport!({
            type: "inputreport",
            data: new DataView(Uint8Array.from(RESPONSE_LOCKED_DEVICE).buffer),
          } as HIDInputReportEvent),
        ),
      );
      const connection = new WebHidDeviceConnection(
        { device, apduSender, apduReceiver, onConnectionTerminated, deviceId },
        logger,
      );

      // when
      const response = await connection.sendApdu(Uint8Array.from([]), true);

      // then
      expect(response).toEqual(
        Right({
          statusCode: new Uint8Array([0x55, 0x15]),
          data: new Uint8Array([]),
        }),
      );
    });

    test("sendApdu(whatever, true) should return an error if the device gets disconnected while waiting for reconnection", async () => {
      // given
      device.sendReport = jest.fn(() =>
        Promise.resolve(
          device.oninputreport!({
            type: "inputreport",
            data: new DataView(Uint8Array.from(RESPONSE_SUCCESS).buffer),
          } as HIDInputReportEvent),
        ),
      );
      const connection = new WebHidDeviceConnection(
        { device, apduSender, apduReceiver, onConnectionTerminated, deviceId },
        logger,
      );

      const responsePromise = connection.sendApdu(Uint8Array.from([]), true);

      // when disconnecting
      connection.lostConnection();
      jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
      await flushPromises();

      // then
      const response = await responsePromise;
      expect(response).toEqual(Left(new ReconnectionFailedError()));
    });
  });

  describe("connection lost before sending an APDU", () => {
    test("sendApdu(whatever, false) should return an error if the device connection has been lost and times out", async () => {
      // given
      device.sendReport = jest.fn(() =>
        Promise.resolve(
          device.oninputreport!({
            type: "inputreport",
            data: new DataView(Uint8Array.from(RESPONSE_SUCCESS).buffer),
          } as HIDInputReportEvent),
        ),
      );
      const connection = new WebHidDeviceConnection(
        { device, apduSender, apduReceiver, onConnectionTerminated, deviceId },
        logger,
      );

      // when losing connection
      connection.lostConnection();
      jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
      await flushPromises();

      // then
      const response = await connection.sendApdu(Uint8Array.from([]), false);
      await flushPromises();
      expect(response).toEqual(Left(new ReconnectionFailedError()));
    });

    test("sendApdu(whatever, false) should wait for reconnection to resolve", async () => {
      // given
      device.sendReport = jest.fn(() =>
        Promise.resolve(
          device.oninputreport!({
            type: "inputreport",
            data: new DataView(Uint8Array.from(RESPONSE_SUCCESS).buffer),
          } as HIDInputReportEvent),
        ),
      );
      const connection = new WebHidDeviceConnection(
        { device, apduSender, apduReceiver, onConnectionTerminated, deviceId },
        logger,
      );

      // when losing connection
      connection.lostConnection();

      let hasResolved = false;
      const responsePromise = connection
        .sendApdu(Uint8Array.from([]), false)
        .then((response) => {
          hasResolved = true;
          return response;
        });

      // before reconnecting
      await flushPromises();
      expect(hasResolved).toBe(false);

      // when reconnecting
      connection.reconnectHidDevice(device);
      await flushPromises();
      expect(hasResolved).toBe(true);

      const response = await responsePromise;

      expect(response).toEqual(
        Right({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array([]),
        }),
      );
    });
  });
});
