import { defaultApduReceiverServiceStubBuilder } from "@internal/device-session/service/DefaultApduReceiverService.stub";
import { defaultApduSenderServiceStubBuilder } from "@internal/device-session/service/DefaultApduSenderService.stub";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/__mocks__/DefaultLoggerService";
import { UsbHidDeviceConnectionFactory } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory";

const loggerFactory = () => new DefaultLoggerPublisherService();

export const usbHidDeviceConnectionFactoryStubBuilder = () =>
  new UsbHidDeviceConnectionFactory(
    () => defaultApduSenderServiceStubBuilder({}, loggerFactory),
    () => defaultApduReceiverServiceStubBuilder({}, loggerFactory),
    loggerFactory,
  );
