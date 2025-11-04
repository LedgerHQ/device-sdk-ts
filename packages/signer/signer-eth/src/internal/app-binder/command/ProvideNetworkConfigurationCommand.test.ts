import {
  type ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { EthAppCommandError } from "./utils/ethAppErrors";
import {
  NetworkConfigurationType,
  ProvideNetworkConfigurationCommand,
  type ProvideNetworkConfigurationCommandArgs,
} from "./ProvideNetworkConfigurationCommand";

describe("ProvideNetworkConfigurationCommand", () => {
  describe("name", () => {
    it("should be 'provideNetworkConfiguration'", () => {
      const command = new ProvideNetworkConfigurationCommand({
        data: new Uint8Array(),
        isFirstChunk: true,
        configurationType: NetworkConfigurationType.CONFIGURATION,
      });
      expect(command.name).toBe("provideNetworkConfiguration");
    });
  });

  describe("getApdu", () => {
    it("should return the raw APDU for the first chunk", () => {
      // GIVEN
      const args: ProvideNetworkConfigurationCommandArgs = {
        data: Uint8Array.from([0x01, 0x02, 0x03]),
        isFirstChunk: true,
        configurationType: NetworkConfigurationType.CONFIGURATION,
      };

      // WHEN
      const command = new ProvideNetworkConfigurationCommand(args);
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x30, 0x01, 0x00, 0x03, 0x01, 0x02, 0x03]),
      );
    });

    it("should return the raw APDU for the subsequent chunk", () => {
      // GIVEN
      const args: ProvideNetworkConfigurationCommandArgs = {
        data: Uint8Array.from([0x04, 0x05, 0x06]),
        isFirstChunk: false,
        configurationType: NetworkConfigurationType.CONFIGURATION,
      };

      // WHEN
      const command = new ProvideNetworkConfigurationCommand(args);
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x30, 0x00, 0x00, 0x03, 0x04, 0x05, 0x06]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return an error if the response status code is invalid", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x6d, 0x00]), // Invalid status code
      };

      // WHEN
      const command = new ProvideNetworkConfigurationCommand({
        data: new Uint8Array(0),
        isFirstChunk: true,
        configurationType: NetworkConfigurationType.CONFIGURATION,
      });
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        throw new Error("Expected an error");
      } else {
        expect(result.error).toBeDefined();
        expect(result.error).toBeInstanceOf(EthAppCommandError);
      }
    });

    it("should return a success result if the response status code is valid", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
      };

      // WHEN
      const command = new ProvideNetworkConfigurationCommand({
        data: new Uint8Array(0),
        isFirstChunk: true,
        configurationType: NetworkConfigurationType.CONFIGURATION,
      });
      const result = command.parseResponse(response);

      // THEN
      if (!isSuccessCommandResult(result)) {
        throw new Error("Expected a success result");
      } else {
        expect(result.data).toBeUndefined();
      }
    });
  });
});
