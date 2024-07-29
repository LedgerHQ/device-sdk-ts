import {
  Apdu,
  ApduBuilder,
  ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  CommandUtils,
  InvalidStatusWordError,
  isHexaString,
} from "@ledgerhq/device-sdk-core";

import {
  GetAddressCommandArgs,
  GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";

const CHAIN_CODE_LENGTH = 32;

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs>
{
  args: GetAddressCommandArgs;

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getEthAddressArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x02,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: this.args.returnChainCode ? 0x01 : 0x00,
    };
    const builder = new ApduBuilder(getEthAddressArgs);
    const derivationPath = this.args.derivationPath;

    const path = this.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    // TODO: replace by 64
    builder.add32BitUIntToData(0);
    builder.add32BitUIntToData(1);

    return builder.build();
  }

  parseResponse(response: ApduResponse): GetAddressCommandResponse {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler
    if (!CommandUtils.isSuccessResponse(response)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          response.statusCode,
        )}`,
      );
    }

    const publicKeyLength = parser.extract8BitUInt();
    if (publicKeyLength === undefined) {
      throw new InvalidStatusWordError("Public key length is missing");
    }

    if (parser.testMinimalLength(publicKeyLength) === false) {
      throw new InvalidStatusWordError("Public key is missing");
    }

    const publicKey = parser.encodeToHexaString(
      parser.extractFieldByLength(publicKeyLength),
    );

    const addressLength = parser.extract8BitUInt();
    if (addressLength === undefined) {
      throw new InvalidStatusWordError("Ethereum address length is missing");
    }

    if (parser.testMinimalLength(addressLength) === false) {
      throw new InvalidStatusWordError("Ethereum address is missing");
    }

    const result = parser.encodeToString(
      parser.extractFieldByLength(addressLength),
    );

    const address = `0x${result}`;

    if (isHexaString(address) === false) {
      throw new InvalidStatusWordError("Invalid Ethereum address");
    }

    let chainCode = undefined;
    if (this.args.returnChainCode) {
      if (parser.testMinimalLength(CHAIN_CODE_LENGTH) === false) {
        throw new InvalidStatusWordError("Chain code is missing");
      }

      chainCode = parser.encodeToHexaString(
        parser.extractFieldByLength(CHAIN_CODE_LENGTH),
      );
    }

    return {
      publicKey,
      address,
      chainCode,
    };
  }

  private splitPath(path: string): number[] {
    const result: number[] = [];
    const components = path.split("/");
    components.forEach((element) => {
      let number = parseInt(element, 10);
      if (isNaN(number)) {
        return; // FIXME: shouldn't it throws instead?
      }
      if (element.length > 1 && element[element.length - 1] === "'") {
        number += 0x80000000;
      }
      result.push(number);
    });
    return result;
  }
}
