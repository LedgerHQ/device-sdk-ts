import { defaultApduReceiverServiceStubBuilder } from "@api/device-session/service/DefaultApduReceiverService.stub";
import { defaultApduSenderServiceStubBuilder } from "@api/device-session/service/DefaultApduSenderService.stub";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/__mocks__/DefaultLoggerService";
import { WebHidDeviceConnectionFactory } from "@internal/transport/usb/service/WebHidDeviceConnectionFactory";

const loggerFactory = () => new DefaultLoggerPublisherService();

export const webHidDeviceConnectionFactoryStubBuilder = () =>
  new WebHidDeviceConnectionFactory(
    () => defaultApduSenderServiceStubBuilder({}, loggerFactory),
    () => defaultApduReceiverServiceStubBuilder({}, loggerFactory),
    loggerFactory,
  );
