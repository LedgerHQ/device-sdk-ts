import { DeviceSdk } from "@ledgerhq/device-sdk-core";

import { EthAppBinder } from "./EthAppBinder";

describe("getAddress", () => {
  const mockedSdk: DeviceSdk = {
    sendCommand: jest.fn(),
    executeDeviceAction: jest.fn(),
  } as unknown as DeviceSdk;

  it("should return the address, publicKey, and chainCode", async () => {
    // GIVEN
    const address = "0xF7C69BedB292Dd3fC2cA4103989B5BD705164c43";
    const publicKey = "04e3785ca";
    const chainCode = undefined;
    // TODO: replace with a DeviceAction
    jest.spyOn(mockedSdk, "sendCommand").mockResolvedValue({
      address,
      publicKey,
      chainCode,
    });

    // WHEN
    const appBinder = new EthAppBinder(mockedSdk, "sessionId");
    const result = await appBinder.getAddress({
      derivationPath: "44'/60'/3'/2/1",
    });

    // THEN
    expect(result.address).toEqual(address);
    expect(result.publicKey).toEqual(publicKey);
    expect(result.chainCode).toEqual(chainCode);
  });
});
