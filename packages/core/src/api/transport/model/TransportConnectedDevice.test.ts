import { deviceModelStubBuilder } from "@api/device-model/model/DeviceModel.stub";
import { defaultApduResponseStubBuilder } from "@api/device-session/ApduResponse.stub";

import { TransportConnectedDevice } from "./TransportConnectedDevice";
import { connectedDeviceStubBuilder } from "./TransportConnectedDevice.stub";

describe("TransportConnectedDevice", () => {
  let connectedDevice: TransportConnectedDevice;

  beforeEach(() => {
    connectedDevice = connectedDeviceStubBuilder();
  });

  it("should create an instance", () => {
    expect(connectedDevice).toBeDefined();
    expect(connectedDevice).toBeInstanceOf(TransportConnectedDevice);
  });

  it("should return the correct id", () => {
    expect(connectedDevice.id).toEqual("42");
  });

  it("should return the correct device model", () => {
    expect(JSON.stringify(connectedDevice.deviceModel)).toEqual(
      JSON.stringify(deviceModelStubBuilder()),
    );
  });

  it("should return the correct type", () => {
    expect(connectedDevice.type).toEqual("MOCK");
  });

  it("should return the correct send apdu response", () => {
    expect(connectedDevice.sendApdu(new Uint8Array())).toMatchObject(
      Promise.resolve(defaultApduResponseStubBuilder()),
    );
  });
});
