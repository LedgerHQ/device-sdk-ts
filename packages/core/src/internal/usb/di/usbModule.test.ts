import { Container } from "inversify";

import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { usbDiTypes } from "./usbDiTypes";
import { usbModuleFactory } from "./usbModule";

describe("usbModuleFactory", () => {
  let container: Container;
  let mod: ReturnType<typeof usbModuleFactory>;
  beforeEach(() => {
    mod = usbModuleFactory();
    container = new Container();
    container.load(mod, deviceModelModuleFactory());
  });

  it("should return the usb module", () => {
    expect(mod).toBeDefined();
  });

  it("should return none mocked transports", () => {
    const usbHidTransport = container.get(usbDiTypes.UsbHidTransport);
    expect(usbHidTransport).toBeInstanceOf(WebUsbHidTransport);
  });
});
