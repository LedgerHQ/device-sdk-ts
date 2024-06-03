import { ContainerModule } from "inversify";

import { UsbHidDeviceConnectionFactory } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory";

import { usbDiTypes } from "./usbDiTypes";

type FactoryProps = {
  stub: boolean;
};

export const usbModuleFactory = ({
  stub = false,
}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    // UsbHidDeviceConnectionFactory
    bind(usbDiTypes.UsbHidDeviceConnectionFactory).to(
      UsbHidDeviceConnectionFactory,
    );

    if (stub) {
      // Add stubs here
    }
  });
