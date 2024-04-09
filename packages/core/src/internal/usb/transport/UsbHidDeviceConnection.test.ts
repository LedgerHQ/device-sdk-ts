import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { defaultApduReceiverServiceStubBuilder } from "@internal/device-session/service/DefaultApduReceiverService.stub";
import { defaultApduSenderServiceStubBuilder } from "@internal/device-session/service/DefaultApduSenderService.stub";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { hidDeviceStubBuilder } from "@internal/usb/model/HIDDevice.stub";
import { UsbHidDeviceConnection } from "@internal/usb/transport/UsbHidDeviceConnection";

const RESPONSE_LOCKED_DEVICE = new Uint8Array([
  0xaa, 0xaa, 0x05, 0x00, 0x00, 0x00, 0x02, 0x55, 0x15, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

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

  it("should send APDU through hid report", async () => {
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

  it("should receive APDU through hid report", async () => {
    // given
    device.sendReport = jest.fn(async () => {
      device.oninputreport!({
        type: "inputreport",
        data: new DataView(Uint8Array.from(RESPONSE_LOCKED_DEVICE).buffer),
      } as HIDInputReportEvent);
    });
    const connection = new UsbHidDeviceConnection(
      { device, apduSender, apduReceiver },
      logger,
    );
    // when
    const response = connection.sendApdu(Uint8Array.from([]));
    // then
    expect(response).resolves.toBe(RESPONSE_LOCKED_DEVICE);
  });
});
