import { ConnectionType } from "@api/discovery/ConnectionType";
import { deviceModelStubBuilder } from "@internal/device-model/model/DeviceModel.stub";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { getJSONStringifyReplacer } from "./WebLogsExporterLogger";

describe("getJSONStringifyReplacer", () => {
  it("should return a function that replaces Uint8Array correctly", () => {
    const replacer = getJSONStringifyReplacer();
    const value = new Uint8Array([1, 2, 3]);
    const result = replacer("key", value);
    expect(result).toEqual({
      hex: "0x010203",
      readableHex: "01 02 03",
      value: "1,2,3",
    });
  });

  it("should return a function that replaces DeviceSession", () => {
    const stubDeviceModel = deviceModelStubBuilder();
    const replacer = getJSONStringifyReplacer();

    const connectedDevice = {
      deviceModel: deviceModelStubBuilder(),
      type: "USB" as ConnectionType,
      id: "mockedDeviceId",
      sendApdu: jest.fn(),
    };

    const value = new DeviceSession(
      {
        connectedDevice,
        id: "mockedSessionId",
      },
      jest.fn(),
      {} as ManagerApiService,
    );
    const result = JSON.stringify(value, replacer);
    const expected = `{"id":"mockedSessionId","connectedDevice":{"deviceModel":${JSON.stringify(
      stubDeviceModel,
    )},"type":"USB","id":"mockedDeviceId"}}`;
    expect(result).toEqual(expected);
  });

  it("should return a function that replaces circular references", () => {
    interface CircularObject {
      name: string;
      self?: CircularObject;
    }

    const obj: CircularObject = { name: "Alice" };
    obj.self = obj;

    const expected = '{"name":"Alice","self":"[Circular]"}';
    const result = JSON.stringify(obj, getJSONStringifyReplacer());
    expect(result).toEqual(expected);
  });
});
