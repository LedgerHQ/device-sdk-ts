import { ContainerModule } from "inversify";

import { UsbHidDeviceConnectionFactory } from "@internal/usb/service/UsbHidDeviceConnectionFactory";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";
import { GetConnectedDeviceUseCase } from "@internal/usb/use-case/GetConnectedDeviceUseCase";

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

    // UsbHidDeviceConnectionFactory
    bind(usbDiTypes.UsbHidDeviceConnectionFactory).to(
      UsbHidDeviceConnectionFactory,
    );

    // GetConnectedDeviceUseCase
    bind(usbDiTypes.GetConnectedDeviceUseCase).to(GetConnectedDeviceUseCase);

    if (stub) {
      // We can rebind our interfaces to their mock implementations
      // rebind(...).to(....);
    }
  });
