import { Left, Right } from "purify-ts";

import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { defaultApduReceiverServiceStubBuilder } from "@internal/device-session/service/DefaultApduReceiverService.stub";
import { defaultApduSenderServiceStubBuilder } from "@internal/device-session/service/DefaultApduSenderService.stub";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { bleCharacteristicStubBuilder } from "@internal/transport/ble/model/BleDevice.stub";
import { DeviceNotInitializedError } from "@internal/transport/model/Errors";
import { ApduResponse } from "@root/src";

import { BleDeviceConnection, DataViewEvent } from "./BleDeviceConnection";

const GET_MTU_APDU = new Uint8Array([0x08, 0x00, 0x00, 0x00, 0x00]);
const GET_MTU_APDU_RESPONSE = new Uint8Array([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x42,
]);
const EMPTY_APDU_RESPONSE = Uint8Array.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

describe("BleDeviceConnection", () => {
  let writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  let notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
  let apduSenderFactory: () => ApduSenderService;
  let apduReceiverFactory: () => ApduReceiverService;
  const logger = (tag: string) => new DefaultLoggerPublisherService([], tag);

  beforeEach(() => {
    writeCharacteristic = bleCharacteristicStubBuilder();
    notifyCharacteristic = bleCharacteristicStubBuilder();
    apduSenderFactory = jest.fn(() =>
      defaultApduSenderServiceStubBuilder(undefined, logger),
    );
    apduReceiverFactory = jest.fn(() =>
      defaultApduReceiverServiceStubBuilder(undefined, logger),
    );
  });

  function receiveApdu(
    connection: BleDeviceConnection,
    buffer: Uint8Array = Uint8Array.from([]),
  ) {
    // @ts-expect-error private function call to mock web ble response
    connection.onNotifyCharacteristicValueChanged({
      target: {
        value: new DataView(buffer.buffer),
      },
    } as DataViewEvent);
  }

  describe("sendApdu", () => {
    it("should return an error if the device isn't setup", async () => {
      // given
      const connection = new BleDeviceConnection(
        {
          writeCharacteristic,
          notifyCharacteristic,
          apduSenderFactory,
          apduReceiverFactory,
        },
        logger,
      );
      // when
      const errorOrApduResponse = await connection.sendApdu(
        Uint8Array.from([]),
      );
      // then
      expect(errorOrApduResponse).toStrictEqual(
        Left(new DeviceNotInitializedError("Unknown MTU")),
      );
    });

    it("should call writeValueWithResponse if device is setup", async () => {
      // given
      const connection = new BleDeviceConnection(
        {
          writeCharacteristic,
          notifyCharacteristic,
          apduSenderFactory,
          apduReceiverFactory,
        },
        logger,
      );
      // when
      receiveApdu(connection, GET_MTU_APDU_RESPONSE);
      const response = connection.sendApdu(new Uint8Array([]));
      receiveApdu(connection, EMPTY_APDU_RESPONSE);
      // then
      expect(await response).toStrictEqual(
        Right(
          new ApduResponse({
            statusCode: Uint8Array.from([]),
            data: Uint8Array.from([]),
          }),
        ),
      );
    });
  });
  describe("setup", () => {
    it("should send the apdu 0x0800000000 to get mtu size", async () => {
      // given
      const connection = new BleDeviceConnection(
        {
          writeCharacteristic,
          notifyCharacteristic,
          apduSenderFactory,
          apduReceiverFactory,
        },
        logger,
      );
      // when
      await connection.setup();
      // then
      expect(writeCharacteristic.writeValueWithResponse).toHaveBeenCalledWith(
        new Uint8Array(GET_MTU_APDU),
      );
    });
    it("should setup apduSender with the correct mtu size", () => {
      // given
      const connection = new BleDeviceConnection(
        {
          writeCharacteristic,
          notifyCharacteristic,
          apduSenderFactory,
          apduReceiverFactory,
        },
        logger,
      );
      // when
      receiveApdu(connection, GET_MTU_APDU_RESPONSE);
      // then
      expect(apduSenderFactory).toHaveBeenCalledWith({ frameSize: 0x42 });
    });
  });
});
