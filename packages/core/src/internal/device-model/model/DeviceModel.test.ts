import { DeviceModelId } from "@api/device/DeviceModel";

import { InternalDeviceModel } from "./DeviceModel";
import { deviceModelStubBuilder } from "./DeviceModel.stub";

describe("DeviceModel", () => {
  let stubDeviceModel: InternalDeviceModel;

  beforeAll(() => {
    stubDeviceModel = deviceModelStubBuilder();
  });

  test("should return the correct block size for Nano X", () => {
    const deviceModel = new InternalDeviceModel(stubDeviceModel);
    const firmwareVersion = "2.0.0";

    expect(deviceModel.getBlockSize(firmwareVersion)).toBe(4 * 1024);
  });

  test("should return the correct block size for Stax", () => {
    const deviceModel = new InternalDeviceModel({
      ...stubDeviceModel,
      id: DeviceModelId.STAX,
    });
    const firmwareVersion = "2.0.0";

    expect(deviceModel.getBlockSize(firmwareVersion)).toBe(32);
  });

  test("should return the correct block size for Nano SP", () => {
    const deviceModel = new InternalDeviceModel({
      ...stubDeviceModel,
      id: DeviceModelId.NANO_SP,
    });
    const firmwareVersion = "2.0.0";

    expect(deviceModel.getBlockSize(firmwareVersion)).toBe(32);
  });

  test("should return the correct block size for Nano S with version lower than 2.0.0", () => {
    const deviceModel = new InternalDeviceModel({
      ...stubDeviceModel,
      id: DeviceModelId.NANO_S,
    });
    const firmwareVersion = "1.0.0";

    expect(deviceModel.getBlockSize(firmwareVersion)).toBe(4 * 1024);
  });

  test("should return the correct block size for Nano S with version 2.0.0", () => {
    const deviceModel = new InternalDeviceModel({
      ...stubDeviceModel,
      id: DeviceModelId.NANO_S,
    });
    const firmwareVersion = "2.0.0";

    expect(deviceModel.getBlockSize(firmwareVersion)).toBe(2 * 1024);
  });

  // flex
  test("should return the correct block size for Flex", () => {
    const deviceModel = new InternalDeviceModel({
      ...stubDeviceModel,
      id: DeviceModelId.FLEX,
    });
    const firmwareVersion = "2.0.0";

    expect(deviceModel.getBlockSize(firmwareVersion)).toBe(32);
  });
});
