import { ContainerModule } from "inversify";

import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { usbDiTypes } from "./usbDiTypes";

type FactoryProps = {
  stub: boolean;
};

export const usbModuleFactory = ({
  stub = false,
}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    // The transport needs to be a singleton to keep the internal states of the devices
    bind(usbDiTypes.UsbHidTransport).to(WebUsbHidTransport).inSingletonScope();

    if (stub) {
      // We can rebind our interfaces to their mock implementations
      // rebind(...).to(....);
    }
  });
