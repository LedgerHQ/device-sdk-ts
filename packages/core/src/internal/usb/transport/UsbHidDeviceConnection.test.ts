import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { defaultApduReceiverServiceStubBuilder } from "@internal/device-session/service/DefaultApduReceiverService.stub";
import { defaultApduSenderServiceStubBuilder } from "@internal/device-session/service/DefaultApduSenderService.stub";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { hidDeviceStubBuilder } from "@internal/usb/model/HIDDevice.stub";
import { UsbHidDeviceConnection } from "@internal/usb/transport/UsbHidDeviceConnection";

describe("UsbHidDeviceConnection", () => {
  let device: HIDDevice;
  let apduSender: ApduSenderService;
  let apduReceiver: ApduReceiverService;
  const logger = (tag: string) => new DefaultLoggerPublisherService([], tag);

  beforeEach(async () => {
    device = hidDeviceStubBuilder();
    apduSender = defaultApduSenderServiceStubBuilder(undefined, logger);
    apduReceiver = defaultApduReceiverServiceStubBuilder(undefined, logger);
  });

  it("should get device", () => {
    // given
    const connection = new UsbHidDeviceConnection(
      { device, apduSender, apduReceiver },
      logger,
    );
    // when
    const cDevice = connection.device;
    // then
    expect(cDevice).toStrictEqual(device);
  });

  it("should send APDU through hid report", () => {
    // given
    const connection = new UsbHidDeviceConnection(
      { device, apduSender, apduReceiver },
      logger,
    );
    // when
    connection.sendApdu(new Uint8Array(0));
    // then
    expect(device.sendReport).toHaveBeenCalled();
  });
});
