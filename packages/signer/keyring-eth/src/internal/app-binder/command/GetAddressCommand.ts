import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
  isHexaString,
} from "@ledgerhq/device-management-kit";

import {
  GetAddressCommandArgs,
  GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

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

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    // TODO: replace by 64
    builder.add32BitUIntToData(0);
    builder.add32BitUIntToData(1);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse> {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    const publicKeyLength = parser.extract8BitUInt();
    if (publicKeyLength === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Public key length is missing"),
      });
    }

    if (parser.testMinimalLength(publicKeyLength) === false) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Public key is missing"),
      });
    }

    const publicKey = parser.encodeToHexaString(
      parser.extractFieldByLength(publicKeyLength),
    );

    const addressLength = parser.extract8BitUInt();
    if (addressLength === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Ethereum address length is missing"),
      });
    }

    if (parser.testMinimalLength(addressLength) === false) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Ethereum address is missing"),
      });
    }

    const result = parser.encodeToString(
      parser.extractFieldByLength(addressLength),
    );

    const address = `0x${result}`;

    if (isHexaString(address) === false) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid Ethereum address"),
      });
    }

    let chainCode = undefined;
    if (this.args.returnChainCode) {
      if (parser.testMinimalLength(CHAIN_CODE_LENGTH) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid Ethereum address"),
        });
      }

      chainCode = parser.encodeToHexaString(
        parser.extractFieldByLength(CHAIN_CODE_LENGTH),
      );
    }

    return CommandResultFactory({
      data: {
        publicKey,
        address,
        chainCode,
      },
    });
  }
}
