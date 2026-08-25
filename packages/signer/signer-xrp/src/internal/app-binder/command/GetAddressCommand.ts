import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidResponseFormatError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";

import {
  INS,
  P1_DEFAULT,
  P1_DISPLAY,
  P2_RETURN_CHAIN_CODE,
  P2_SECP256K1,
  XRP_CLA,
} from "./utils/apduHeaderUtils";
import { validateDerivationPath } from "./utils/validateDerivationPath";
import {
  XRP_APP_ERRORS,
  XrpAppCommandErrorFactory,
  type XrpErrorCodes,
} from "./utils/xrpApplicationErrors";

const CHAIN_CODE_LENGTH = 32;

export type { GetAddressCommandArgs, GetAddressCommandResponse };

/**
 * Retrieves an address, and the public key it derives from, from the XRP
 * application.
 *
 * The device answers with
 * `[pkLen][publicKey][addressLen][address][chainCode?]`, where the public key
 * is compressed to 33 bytes by the app and the address is ASCII. Both are
 * length-prefixed, so they are parsed by their prefix rather than by a fixed
 * size.
 */
export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, XrpErrorCodes>
{
  readonly name = "GetAddress";

  private readonly args: GetAddressCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    XrpErrorCodes
  >(XRP_APP_ERRORS, XrpAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice, returnChainCode } = this.args;

    const getAddressArgs: ApduBuilderArgs = {
      cla: XRP_CLA,
      ins: INS.GET_PUBLIC_KEY,
      p1: checkOnDevice ? P1_DISPLAY : P1_DEFAULT,
      // P2 is a bitmask: the curve selector in the high bits, the chain code
      // flag in the low bit.
      p2: P2_SECP256K1 | (returnChainCode ? P2_RETURN_CHAIN_CODE : 0x00),
    };

    const builder = new ApduBuilder(getAddressArgs);
    const path = validateDerivationPath(derivationPath);

    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, XrpErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const publicKeyLength = parser.extract8BitUInt();
      if (publicKeyLength === undefined) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError(
            "Cannot extract public key length",
          ),
        });
      }
      if (!parser.testMinimalLength(publicKeyLength)) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError("Cannot extract public key"),
        });
      }
      const publicKey = parser.encodeToHexaString(
        parser.extractFieldByLength(publicKeyLength),
      );

      const addressLength = parser.extract8BitUInt();
      if (addressLength === undefined) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError(
            "Cannot extract address length",
          ),
        });
      }
      if (!parser.testMinimalLength(addressLength)) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError("Cannot extract address"),
        });
      }
      // The app returns the address as ASCII, so it is passed through as-is.
      const address = parser.encodeToString(
        parser.extractFieldByLength(addressLength),
      );

      let chainCode: string | undefined = undefined;
      if (this.args.returnChainCode) {
        if (!parser.testMinimalLength(CHAIN_CODE_LENGTH)) {
          return CommandResultFactory({
            error: new InvalidResponseFormatError("Cannot extract chain code"),
          });
        }
        chainCode = parser.encodeToHexaString(
          parser.extractFieldByLength(CHAIN_CODE_LENGTH),
        );
      }

      return CommandResultFactory({
        data: { publicKey, address, chainCode },
      });
    });
  }
}
