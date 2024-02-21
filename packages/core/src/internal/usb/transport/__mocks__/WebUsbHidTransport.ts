import { UsbHidTransport } from "@internal/usb/transport/UsbHidTransport";

export class WebUsbHidTransport implements UsbHidTransport {
  isSupported = jest.fn();
  connect = jest.fn();
  startDiscovering = jest.fn();
  stopDiscovering = jest.fn();
}

export function usbHidTransportMockBuilder(
  props: Partial<UsbHidTransport> = {},
): UsbHidTransport {
  return {
    isSupported: jest.fn(),
    startDiscovering: jest.fn(),
    stopDiscovering: jest.fn(),
    connect: jest.fn(),
    ...props,
  };
}
