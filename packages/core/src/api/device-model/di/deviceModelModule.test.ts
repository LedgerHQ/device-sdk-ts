import { Container } from "inversify";

import { StaticDeviceModelDataSource } from "@api/device-model/data/StaticDeviceModelDataSource";

import { deviceModelModuleFactory } from "./deviceModelModule";
import { deviceModelTypes } from "./deviceModelTypes";

describe("deviceModelModuleFactory", () => {
  let container: Container;
  let mod: ReturnType<typeof deviceModelModuleFactory>;
  beforeEach(() => {
    mod = deviceModelModuleFactory({ stub: false });
    container = new Container();
    container.load(mod);
  });

  it("should return the device module", () => {
    expect(mod).toBeDefined();
  });

  it("should return none mocked services and data sources", () => {
    const deviceModelDataSource = container.get(
      deviceModelTypes.DeviceModelDataSource,
    );
    expect(deviceModelDataSource).toBeInstanceOf(StaticDeviceModelDataSource);
  });
});
