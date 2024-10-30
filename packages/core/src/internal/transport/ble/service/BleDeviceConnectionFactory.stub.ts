import { defaultApduReceiverServiceStubBuilder } from "@api/device-session/service/DefaultApduReceiverService.stub";
import { defaultApduSenderServiceStubBuilder } from "@api/device-session/service/DefaultApduSenderService.stub";
import { DefaultLoggerPublisherServiceStub } from "@internal/logger-publisher/service/DefaultLoggerService.stub";
import { BleDeviceConnectionFactory } from "@internal/transport/ble/service/BleDeviceConnectionFactory";

const loggerFactory = () => new DefaultLoggerPublisherServiceStub();

export const bleDeviceConnectionFactoryStubBuilder = () =>
  new BleDeviceConnectionFactory(
    () => defaultApduSenderServiceStubBuilder({}, loggerFactory),
    () => defaultApduReceiverServiceStubBuilder({}, loggerFactory),
    loggerFactory,
  );
