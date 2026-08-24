import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import {
  INS,
  XRP_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import { DerivationPathTooLongError } from "@internal/app-binder/command/utils/validateDerivationPath";
import { type XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";

const DERIVATION_PATH = "44'/144'/0'/0/0";

// The path above, encoded the way the legacy hw-app-xrp client emits it: a
// count byte then each element as a big-endian u32, hardened elements OR-ed
// with 0x80000000.
const ENCODED_PATH = [
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x90, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

const buildExpectedApdu = (p1: number, p2: number) =>
  Uint8Array.from([
    XRP_CLA,
    INS.GET_PUBLIC_KEY,
    p1,
    p2,
    ENCODED_PATH.length,
    ...ENCODED_PATH,
  ]);

// Uncompressed secp256k1 public key: 0x04 then two 32-byte coordinates.
const PUBLIC_KEY = Uint8Array.from([
  0x04,
  ...Array.from({ length: 64 }, (_, i) => (i + 1) & 0xff),
]);
const PUBLIC_KEY_HEX =
  "04" +
  Array.from({ length: 64 }, (_, i) =>
    ((i + 1) & 0xff).toString(16).padStart(2, "0"),
  ).join("");

const ADDRESS = "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv";
const ADDRESS_BYTES = Array.from(ADDRESS, (c) => c.charCodeAt(0));

const CHAIN_CODE = Uint8Array.from(
  Array.from({ length: 32 }, (_, i) => (0xa0 + i) & 0xff),
);
const CHAIN_CODE_HEX = Array.from(CHAIN_CODE, (b) =>
  b.toString(16).padStart(2, "0"),
).join("");

const success = (data: number[]) =>
  new ApduResponse({
    statusCode: Uint8Array.from([0x90, 0x00]),
    data: Uint8Array.from(data),
  });

const nominalBody = ({ withChainCode = false } = {}) => [
  PUBLIC_KEY.length,
  ...PUBLIC_KEY,
  ADDRESS_BYTES.length,
  ...ADDRESS_BYTES,
  ...(withChainCode ? Array.from(CHAIN_CODE) : []),
];

describe("GetAddressCommand", () => {
  describe("name", () => {
    it("should be 'GetAddress'", () => {
      expect(
        new GetAddressCommand({ derivationPath: DERIVATION_PATH }).name,
      ).toBe("GetAddress");
    });
  });

  describe("getApdu", () => {
    // 2 display x 2 chain code, the curve selector being always secp256k1.
    const matrix: {
      checkOnDevice: boolean;
      returnChainCode: boolean;
      p1: number;
      p2: number;
    }[] = [
      {
        checkOnDevice: false,
        returnChainCode: false,
        p1: 0x00,
        p2: 0x40,
      },
      {
        checkOnDevice: false,
        returnChainCode: true,
        p1: 0x00,
        p2: 0x41,
      },
      {
        checkOnDevice: true,
        returnChainCode: false,
        p1: 0x01,
        p2: 0x40,
      },
      {
        checkOnDevice: true,
        returnChainCode: true,
        p1: 0x01,
        p2: 0x41,
      },
    ];

    it.each(matrix)(
      "should build P1=$p1 P2=$p2 for checkOnDevice=$checkOnDevice returnChainCode=$returnChainCode",
      ({ checkOnDevice, returnChainCode, p1, p2 }) => {
        // GIVEN
        const command = new GetAddressCommand({
          derivationPath: DERIVATION_PATH,
          checkOnDevice,
          returnChainCode,
        });

        // WHEN
        const apdu = command.getApdu();

        // THEN
        expect(apdu.getRawApdu()).toStrictEqual(buildExpectedApdu(p1, p2));
      },
    );

    it("should default to no display and no chain code", () => {
      // GIVEN
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(buildExpectedApdu(0x00, 0x40));
    });

    it("should accept a 10 element derivation path", () => {
      // GIVEN
      const command = new GetAddressCommand({
        derivationPath: "44'/144'/0'/0/0/0/0/0/0/0",
      });

      // WHEN / THEN
      expect(() => command.getApdu()).not.toThrow();
    });

    it("should reject a derivation path longer than 10 elements", () => {
      // GIVEN
      const command = new GetAddressCommand({
        derivationPath: "44'/144'/0'/0/0/0/0/0/0/0/0",
      });

      // WHEN / THEN
      expect(() => command.getApdu()).toThrow(DerivationPathTooLongError);
    });
  });

  describe("parseResponse", () => {
    it("should parse the public key and the ASCII address", () => {
      // GIVEN
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      });

      // WHEN
      const result = command.parseResponse(success(nominalBody()));

      // THEN
      if (!isSuccessCommandResult(result)) {
        assert.fail("Expected a success");
      }
      expect(result.data.publicKey).toBe(PUBLIC_KEY_HEX);
      expect(result.data.publicKey).toHaveLength(130); // 65 bytes
      // Passed through as-is: no `0x` prefix, unlike the Ethereum signer.
      expect(result.data.address).toBe(ADDRESS);
      expect(result.data.chainCode).toBeUndefined();
    });

    it("should parse a compressed public key, as the app actually sends", () => {
      // GIVEN the 33 byte key the app compresses its answer down to, which is
      // shorter than the 65 bytes the APDU spec describes — the length prefix
      // is what decides, never a constant.
      const compressedKey = [
        0x02,
        ...Array.from({ length: 32 }, (_, i) => (i + 1) & 0xff),
      ];
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      });

      // WHEN
      const result = command.parseResponse(
        success([
          compressedKey.length,
          ...compressedKey,
          ADDRESS_BYTES.length,
          ...ADDRESS_BYTES,
        ]),
      );

      // THEN
      if (!isSuccessCommandResult(result)) {
        assert.fail("Expected a success");
      }
      expect(result.data.publicKey).toHaveLength(66); // 33 bytes
      expect(result.data.address).toBe(ADDRESS);
    });

    it("should parse the chain code when it was requested", () => {
      // GIVEN
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        returnChainCode: true,
      });

      // WHEN
      const result = command.parseResponse(
        success(nominalBody({ withChainCode: true })),
      );

      // THEN
      if (!isSuccessCommandResult(result)) {
        assert.fail("Expected a success");
      }
      expect(result.data.chainCode).toBe(CHAIN_CODE_HEX);
    });

    it("should ignore trailing chain code bytes when it was not requested", () => {
      // GIVEN
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      });

      // WHEN
      const result = command.parseResponse(
        success(nominalBody({ withChainCode: true })),
      );

      // THEN
      if (!isSuccessCommandResult(result)) {
        assert.fail("Expected a success");
      }
      expect(result.data.address).toBe(ADDRESS);
      expect(result.data.chainCode).toBeUndefined();
    });

    describe("truncated responses", () => {
      const cases: { name: string; data: number[]; message: string }[] = [
        {
          name: "public key length is missing",
          data: [],
          message: "Cannot extract public key length",
        },
        {
          name: "public key is truncated",
          data: [PUBLIC_KEY.length, ...Array.from(PUBLIC_KEY).slice(0, 10)],
          message: "Cannot extract public key",
        },
        {
          name: "address length is missing",
          data: [PUBLIC_KEY.length, ...PUBLIC_KEY],
          message: "Cannot extract address length",
        },
        {
          name: "address is truncated",
          data: [
            PUBLIC_KEY.length,
            ...PUBLIC_KEY,
            ADDRESS_BYTES.length,
            ...ADDRESS_BYTES.slice(0, 5),
          ],
          message: "Cannot extract address",
        },
      ];

      it.each(cases)("should fail when the $name", ({ data, message }) => {
        // GIVEN
        const command = new GetAddressCommand({
          derivationPath: DERIVATION_PATH,
        });

        // WHEN
        const result = command.parseResponse(success(data));

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        }
        expect(result.error).toEqual(
          expect.objectContaining({
            _tag: "InvalidResponseFormatError",
            originalError: new Error(message),
          }),
        );
      });

      it("should fail when the chain code is truncated", () => {
        // GIVEN
        const command = new GetAddressCommand({
          derivationPath: DERIVATION_PATH,
          returnChainCode: true,
        });

        // WHEN
        const result = command.parseResponse(
          success([...nominalBody(), ...Array.from(CHAIN_CODE).slice(0, 16)]),
        );

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        }
        expect(result.error).toEqual(
          expect.objectContaining({
            _tag: "InvalidResponseFormatError",
            originalError: new Error("Cannot extract chain code"),
          }),
        );
      });
    });

    it("should map an XRP app status word to an XRP app error", () => {
      // GIVEN
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: true,
      });

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x69, 0x85]),
          data: new Uint8Array(0),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      }
      const error = result.error as XrpAppCommandError;
      expect(error.errorCode).toBe("6985");
      expect(error.message).toBe(
        "Condition of use not satisfied (Rejected by user)",
      );
    });

    it("should map an invalid derivation path status word", () => {
      // GIVEN
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      });

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x81]),
          data: new Uint8Array(0),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      }
      const error = result.error as XrpAppCommandError;
      expect(error.errorCode).toBe("6a81");
      expect(error.message).toBe("Invalid derivation path");
    });
  });
});
