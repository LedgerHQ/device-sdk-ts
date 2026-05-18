import { isSuccessCommandResult } from "@ledgerhq/device-management-kit";

import {
  TRANSACTION_CHECK_CLA,
  TRANSACTION_CHECK_INS,
} from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import {
  TRANSACTION_CHECK_P1_OPT_IN,
  Web3CheckOptInCommand,
} from "@internal/app-binder/command/Web3CheckOptInCommand";

describe("Web3CheckOptInCommand", () => {
  describe("name", () => {
    it("should be 'web3CheckOptIn'", () => {
      const command = new Web3CheckOptInCommand();
      expect(command.name).toBe("web3CheckOptIn");
    });
  });

  describe("getApdu", () => {
    it("should return the raw APDU with correct header and dummy payload", () => {
      const command = new Web3CheckOptInCommand();
      const apdu = command.getApdu();
      const raw = apdu.getRawApdu();

      expect(raw[0]).toBe(TRANSACTION_CHECK_CLA);
      expect(raw[1]).toBe(TRANSACTION_CHECK_INS);
      expect(raw[2]).toBe(TRANSACTION_CHECK_P1_OPT_IN);
      expect(raw[3]).toBe(0x00); // P2
      expect(raw[4]).toBe(0x01); // Lc (1 byte payload)
      expect(raw[5]).toBe(0x00); // dummy byte
      expect(raw.length).toBe(6);
    });
  });

  describe("parseResponse", () => {
    it("should return enabled: true", () => {
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x01]),
      };
      const result = new Web3CheckOptInCommand().parseResponse(response);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({ enabled: true });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return enabled: false", () => {
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x00]),
      };
      const result = new Web3CheckOptInCommand().parseResponse(response);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({ enabled: false });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return enabled: false if missing byte", () => {
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([]),
      };
      const result = new Web3CheckOptInCommand().parseResponse(response);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({ enabled: false });
      } else {
        assert.fail("Expected a success");
      }
    });
  });
});
