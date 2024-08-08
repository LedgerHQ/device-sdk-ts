import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";

import { ProvideTokenInformationCommand } from "./ProvideTokenInformationCommand";

const PAYLOAD_USDT =
  "0455534454dac17f958d2ee523a2206206994597c13d831ec700000006000000013044022078c66ccea3e4dedb15a24ec3c783d7b582cd260daf62fd36afe9a8212a344aed0220160ba8c1c4b6a8aa6565bed20632a091aeeeb7bfdac67fc6589a6031acbf511c";

const PAYLOAD_USDC =
  "0455534443a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000006000000013045022100b2e358726e4e6a6752cf344017c0e9d45b9a904120758d45f61b2804f9ad5299022015161ef28d8c4481bd9432c13562def9cce688bcfec896ef244c9a213f106cdd";

const PROVIDE_TOKEN_INFORMATION_APDU_USDT = Uint8Array.from([
  0xe0, 0x0a, 0x00, 0x00, 0x67, 0x04, 0x55, 0x53, 0x44, 0x54, 0xda, 0xc1, 0x7f,
  0x95, 0x8d, 0x2e, 0xe5, 0x23, 0xa2, 0x20, 0x62, 0x06, 0x99, 0x45, 0x97, 0xc1,
  0x3d, 0x83, 0x1e, 0xc7, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x30,
  0x44, 0x02, 0x20, 0x78, 0xc6, 0x6c, 0xce, 0xa3, 0xe4, 0xde, 0xdb, 0x15, 0xa2,
  0x4e, 0xc3, 0xc7, 0x83, 0xd7, 0xb5, 0x82, 0xcd, 0x26, 0x0d, 0xaf, 0x62, 0xfd,
  0x36, 0xaf, 0xe9, 0xa8, 0x21, 0x2a, 0x34, 0x4a, 0xed, 0x02, 0x20, 0x16, 0x0b,
  0xa8, 0xc1, 0xc4, 0xb6, 0xa8, 0xaa, 0x65, 0x65, 0xbe, 0xd2, 0x06, 0x32, 0xa0,
  0x91, 0xae, 0xee, 0xb7, 0xbf, 0xda, 0xc6, 0x7f, 0xc6, 0x58, 0x9a, 0x60, 0x31,
  0xac, 0xbf, 0x51, 0x1c,
]);

const PROVIDE_TOKEN_INFORMATION_APDU_USDC = Uint8Array.from([
  0xe0, 0x0a, 0x00, 0x00, 0x68, 0x04, 0x55, 0x53, 0x44, 0x43, 0xa0, 0xb8, 0x69,
  0x91, 0xc6, 0x21, 0x8b, 0x36, 0xc1, 0xd1, 0x9d, 0x4a, 0x2e, 0x9e, 0xb0, 0xce,
  0x36, 0x06, 0xeb, 0x48, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x30,
  0x45, 0x02, 0x21, 0x00, 0xb2, 0xe3, 0x58, 0x72, 0x6e, 0x4e, 0x6a, 0x67, 0x52,
  0xcf, 0x34, 0x40, 0x17, 0xc0, 0xe9, 0xd4, 0x5b, 0x9a, 0x90, 0x41, 0x20, 0x75,
  0x8d, 0x45, 0xf6, 0x1b, 0x28, 0x04, 0xf9, 0xad, 0x52, 0x99, 0x02, 0x20, 0x15,
  0x16, 0x1e, 0xf2, 0x8d, 0x8c, 0x44, 0x81, 0xbd, 0x94, 0x32, 0xc1, 0x35, 0x62,
  0xde, 0xf9, 0xcc, 0xe6, 0x88, 0xbc, 0xfe, 0xc8, 0x96, 0xef, 0x24, 0x4c, 0x9a,
  0x21, 0x3f, 0x10, 0x6c, 0xdd,
]);

describe("ProvideTokenInformationCommand", () => {
  let command: ProvideTokenInformationCommand;

  describe("getApdu", () => {
    it("should return the apdu for usdt payload", () => {
      // GIVEN
      command = new ProvideTokenInformationCommand({ payload: PAYLOAD_USDT });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        PROVIDE_TOKEN_INFORMATION_APDU_USDT,
      );
    });

    it("should return the apdu for usdc payload", () => {
      // GIVEN
      command = new ProvideTokenInformationCommand({ payload: PAYLOAD_USDC });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        PROVIDE_TOKEN_INFORMATION_APDU_USDC,
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      };

      // WHEN
      const parsedResponse = command.parseResponse(response);

      // THEN
      expect(parsedResponse).toStrictEqual(
        CommandResultFactory({ data: undefined }),
      );
    });

    it("should throw an error if the response is invalid", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      // WHEN
      const promise = () => command.parseResponse(response);

      // THEN
      expect(() => {
        promise();
      }).toThrow(InvalidStatusWordError);
    });

    it("should return an error if the response is not successful", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x55, 0x15]),
        data: new Uint8Array(),
      };

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
