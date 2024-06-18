import {
  Apdu,
  ApduBuilder,
  ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  Command,
  CommandUtils,
} from "@ledgerhq/device-sdk-core";

export type GetAddressArgs = {
  /**
   * derivation path
   */
  derivationPath: string;
};

export type GetAddressResponse = {
  /**
   * public key
   */
  publicKey: string;

  /**
   * address
   */
  address: string;
};

/**
 * Command to get the address of the device.
 */
export class GetAddressCommand
  implements Command<GetAddressResponse, GetAddressArgs>
{
  args: GetAddressArgs;

  constructor(args: GetAddressArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    // TODO: replace with the correct APDU
    const getAddressApduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    } as const;
    return new ApduBuilder(getAddressApduArgs).build();
  }

  parseResponse(responseApdu: ApduResponse) {
    const parser = new ApduParser(responseApdu);
    if (!CommandUtils.isSuccessResponse(responseApdu)) {
      // TODO: handle error
      return;
    }

    // TODO: parse the response correctly
    const address = parser.encodeToHexaString(parser.extractFieldByLength(20));
    const publicKey = parser.encodeToHexaString(
      parser.extractFieldByLength(65),
    );

    return {
      address,
      publicKey,
    };
  }
}
