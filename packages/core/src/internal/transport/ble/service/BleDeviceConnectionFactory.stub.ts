import { defaultApduReceiverServiceStubBuilder } from "@api/device-session/service/DefaultApduReceiverService.stub";
import { defaultApduSenderServiceStubBuilder } from "@api/device-session/service/DefaultApduSenderService.stub";
// TODO: Should not import from __mocks__ in a stub
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/__mocks__/DefaultLoggerService";
import { BleDeviceConnectionFactory } from "@internal/transport/ble/service/BleDeviceConnectionFactory";

const loggerFactory = () => new DefaultLoggerPublisherService();

export const bleDeviceConnectionFactoryStubBuilder = () =>
  new BleDeviceConnectionFactory(
    () => defaultApduSenderServiceStubBuilder({}, loggerFactory),
    () => defaultApduReceiverServiceStubBuilder({}, loggerFactory),
    loggerFactory,
  );
