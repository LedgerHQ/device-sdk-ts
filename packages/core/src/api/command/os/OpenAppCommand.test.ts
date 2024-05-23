import { ApduResponse } from "@api/device-session/ApduResponse";

import { OpenAppCommand } from "./OpenAppCommand";

describe("OpenAppCommand", () => {
  let openAppCommand: OpenAppCommand;

  beforeEach(() => {
    openAppCommand = new OpenAppCommand();
  });

  it("should return the correct APDU for opening an application", () => {
    const appName = "MyApp";
    const expectedApdu = Uint8Array.from([
      0xe0, 0xd8, 0x00, 0x00, 0x05, 0x4d, 0x79, 0x41, 0x70, 0x70,
    ]);
    const apdu = openAppCommand.getApdu(appName);
    expect(apdu.getRawApdu()).toStrictEqual(expectedApdu);
  });

  it("should not throw error when command is successful", () => {
    const apduResponse: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([]),
    });
    expect(() => openAppCommand.parseResponse(apduResponse)).not.toThrow();
  });

  it("should throw error when command is unsuccessful", () => {
    const apduResponse: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x6a, 0x81]),
      data: new Uint8Array([]),
    });
    expect(() => openAppCommand.parseResponse(apduResponse)).toThrow();
  });
});
