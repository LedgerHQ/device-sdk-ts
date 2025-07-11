import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

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
        01 02 03
        06
          05 06 07 08 09 0a
        05
          16 17 18 19 1a
        1b
        01 02 03
        07
          20 21 22 23 24 25 26
        05
          2e 2f 30 31 32
        12 13 14
      `.replace(/\s+/g, ""), // (the last three bytes should be ignored)
    );

    // WHEN
    const result = command.parseResponse({
      statusCode: Uint8Array.from([0x90, 0x00]),
      data: mockedResponse,
    });

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          credential: {
            version: 1,
            curveId: 2,
            signAlgorithm: 3,
            publicKey: "05060708090a",
          },
          signature: "161718191a",
          attestation: "1b0102030720212223242526052e2f303132",
        },
      }),
    );
  });

  it("should parsing error response", () => {
    // GIVEN
    const command = new GetSeedIdCommand({
      challengeTLV: mockedChallenge,
    });
    const mockedResponse = hexToBytes(
      `
        01 02 03
        06
          05
        05
          16 17 18 19 1a
        1b
        01 02 03
        07
          20 21 22 23 24 25 26
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
    expect(result).toStrictEqual(
      CommandResultFactory({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        error: expect.any(InvalidStatusWordError), // (That's not an assignment to `any` maybe an eslint bug)
      }),
    );
  });
});
