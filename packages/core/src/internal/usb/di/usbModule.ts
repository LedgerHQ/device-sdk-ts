import { ContainerModule, interfaces } from "inversify";
import { Maybe } from "purify-ts";

import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { DefaultApduReceiverConstructorArgs } from "@internal/device-session/service/DefaultApduReceiverService";
import { DefaultApduSenderServiceConstructorArgs } from "@internal/device-session/service/DefaultApduSenderService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { FRAME_SIZE } from "@internal/usb/data/UsbHidConfig";
import { UsbHidDeviceConnection } from "@internal/usb/transport/UsbHidDeviceConnection";
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
    bind<interfaces.Factory<UsbHidDeviceConnection>>(
      usbDiTypes.UsbHidDeviceConnectionFactory,
    ).toFactory((context) => {
      const apduSenderFactory = context.container.get<
        (args: DefaultApduSenderServiceConstructorArgs) => ApduSenderService
      >(deviceSessionTypes.ApduSenderServiceFactory);
      const apduReceiverFactory = context.container.get<
        (args: DefaultApduReceiverConstructorArgs) => ApduReceiverService
      >(deviceSessionTypes.ApduReceiverServiceFactory);
      const loggerFactory = context.container.get<
        (name: string) => LoggerPublisherService
      >(loggerTypes.LoggerPublisherServiceFactory);

      return (device: HIDDevice) => {
        const channel = Maybe.of(
          new Uint8Array([Math.random() % 0xff, Math.random() % 0xff]),
        );
        return new UsbHidDeviceConnection(
          {
            device,
            apduSender: apduSenderFactory({
              frameSize: FRAME_SIZE,
              channel,
              padding: true,
            }),
            apduReceiver: apduReceiverFactory({ channel }),
          },
          loggerFactory,
        );
      };
    });

    // GetConnectedDeviceUseCase
    bind(usbDiTypes.GetConnectedDeviceUseCase).to(GetConnectedDeviceUseCase);

    if (stub) {
      // We can rebind our interfaces to their mock implementations
      // rebind(...).to(....);
    }
  });
