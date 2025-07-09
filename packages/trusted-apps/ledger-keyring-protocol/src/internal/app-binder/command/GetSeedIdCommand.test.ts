import { CommandResultFactory } from "@ledgerhq/device-management-kit";

import { hexToBytes } from "@internal/utils/hex";

import { GetSeedIdCommand } from "./GetSeedIdCommand";

describe("GetSeedIdCommand", () => {
  const mockedChallenge = "01020304";

  it("should build the correct APDU", () => {
    // GIVEN
    const command = new GetSeedIdCommand({
      challengeTLV: mockedChallenge,
    });

    // WHEN
    const apdu = command.getApdu();

    // THEN
    const challengeBytes = hexToBytes(mockedChallenge);
    expect(apdu.getRawApdu()).toEqual(
      Uint8Array.from([
        0xe0, // CLA
        0x05, // INS
        0x00, // P1
        0x00, // P2
        challengeBytes.length, // Lc
        ...challengeBytes, // CData
      ]),
    );
  });

  it("should parse the response correctly", () => {
    // GIVEN
    const command = new GetSeedIdCommand({
      challengeTLV: mockedChallenge,
    });
    const mockedResponse = hexToBytes(
      `
        01 02 03 04
        05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21 22 23 24 25 
        05
          16 17 18 19 1a
        1b
        1c1d1e1f
        20 21 22 23 24 25 26 27 28 29 2a 2b 2c 2d 2e 2f 30 31 32 33 34 35 36 37 38 39 3a 3b 3c 3d 3e 3f 40 
        05
          2e 2f 30 31 32
      `.replace(/\s+/g, ""),
    );

    // WHEN
    const result = command.parseResponse({
      statusCode: Uint8Array.from([0x90, 0x00]),
      data: mockedResponse,
    });

    // THEN
    expect(result).toEqual(
      CommandResultFactory({
        data: {
          pubKeyHeader: Uint8Array.from([0x01, 0x02, 0x03, 0x04]),
          pubKey: Uint8Array.from([
            0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a,
            0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25,
          ]),
          pubKeySig: Uint8Array.from([0x16, 0x17, 0x18, 0x19, 0x1a]),
          attestationId: Uint8Array.from([0x1b]),
          attestationHeader: Uint8Array.from([0x1c, 0x1d, 0x1e, 0x1f]),
          attestationKey: Uint8Array.from([
            0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a,
            0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35,
            0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40,
          ]),
          attestationSig: Uint8Array.from([0x2e, 0x2f, 0x30, 0x31, 0x32]),
        },
      }),
    );
  });
});
