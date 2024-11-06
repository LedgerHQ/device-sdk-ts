import { Right } from "purify-ts";

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

<<<<<<< HEAD
  it("should return the correct send apdu response", () => {
    expect(connectedDevice.sendApdu(new Uint8Array())).resolves.toMatchObject(
      Right(defaultApduResponseStubBuilder()),
    );
||||||| parent of 61c06245 (✅ (dmk): Add tests for TransportService + fixes)
  it("should return the correct send apdu response", () => {
    expect(connectedDevice.sendApdu(new Uint8Array())).toMatchObject(
      Promise.resolve(defaultApduResponseStubBuilder()),
    );
=======
  it("should return the correct send apdu response", async () => {
    const response = await connectedDevice.sendApdu(new Uint8Array());

    expect(response).toMatchObject(Right(defaultApduResponseStubBuilder()));
>>>>>>> 61c06245 (✅ (dmk): Add tests for TransportService + fixes)
  });
});
