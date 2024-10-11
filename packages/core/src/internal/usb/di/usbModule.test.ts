import { Container } from "inversify";

import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { usbDiTypes } from "./usbDiTypes";
import { usbModuleFactory } from "./usbModule";

describe("usbModuleFactory", () => {
  let container: Container;
  let mod: ReturnType<typeof usbModuleFactory>;
  beforeEach(() => {
    mod = usbModuleFactory({ stub: false });
    container = new Container();
    container.load(loggerModuleFactory());
    container.load(
      mod,
      deviceModelModuleFactory({ stub: false }),
      deviceSessionModuleFactory(),
    );
  });

  it("should return the usb module", () => {
    expect(mod).toBeDefined();
  });

  it("should return none mocked transports", () => {
    const usbHidTransport = container.get(usbDiTypes.UsbHidTransport);
    expect(usbHidTransport).toBeInstanceOf(WebUsbHidTransport);
  });
});
