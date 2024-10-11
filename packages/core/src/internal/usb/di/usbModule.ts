import { ContainerModule } from "inversify";

import { UsbHidDeviceConnectionFactory } from "@internal/usb/service/UsbHidDeviceConnectionFactory";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";
import { GetConnectedDeviceUseCase } from "@internal/usb/use-case/GetConnectedDeviceUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { usbDiTypes } from "./usbDiTypes";

type FactoryProps = {
  stub: boolean;
};

export const usbModuleFactory = ({ stub = false }: FactoryProps) =>
  new ContainerModule((bind, _unbind, _isBound, rebind) => {
    // The transport needs to be a singleton to keep the internal states of the devices
    bind(usbDiTypes.UsbHidTransport).to(WebUsbHidTransport).inSingletonScope();

    // UsbHidDeviceConnectionFactory
    bind(usbDiTypes.UsbHidDeviceConnectionFactory).to(
      UsbHidDeviceConnectionFactory,
    );

    // GetConnectedDeviceUseCase
    bind(usbDiTypes.GetConnectedDeviceUseCase).to(GetConnectedDeviceUseCase);

    if (stub) {
      rebind(usbDiTypes.GetConnectedDeviceUseCase).to(StubUseCase);
    }
  });
