import { defaultApduResponseStubBuilder } from "@api/device-session/ApduResponse.stub";
import { deviceModelStubBuilder } from "@internal/device-model/model/DeviceModel.stub";
import { InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";
import { connectedDeviceStubBuilder } from "@internal/transport/model/InternalConnectedDevice.stub";

describe("InternalConnectedDevice", () => {
  let connectedDevice: InternalConnectedDevice;

  beforeEach(() => {
    connectedDevice = connectedDeviceStubBuilder();
  });

  it("should create an instance", () => {
    expect(connectedDevice).toBeDefined();
    expect(connectedDevice).toBeInstanceOf(InternalConnectedDevice);
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
