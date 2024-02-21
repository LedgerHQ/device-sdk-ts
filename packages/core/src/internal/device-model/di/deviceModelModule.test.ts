import { Container } from "inversify";

import { StaticDeviceModelDataSource } from "@internal/device-model/data/StaticDeviceModelDataSource";

import { deviceModelDiTypes } from "./deviceModelDiTypes";
import { deviceModelModuleFactory } from "./deviceModelModule";

describe("deviceModelModuleFactory", () => {
  let container: Container;
  let mod: ReturnType<typeof deviceModelModuleFactory>;
  beforeEach(() => {
    mod = deviceModelModuleFactory();
    container = new Container();
    container.load(mod);
  });

  it("should return the device module", () => {
    expect(mod).toBeDefined();
  });

  it("should return none mocked services and data sources", () => {
    const deviceModelDataSource = container.get(
      deviceModelDiTypes.DeviceModelDataSource,
    );
    expect(deviceModelDataSource).toBeInstanceOf(StaticDeviceModelDataSource);
  });
});
