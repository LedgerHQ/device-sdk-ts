import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper, DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  XRP_APP_ERRORS,
  XrpAppCommandErrorFactory,
  type XrpErrorCodes,
} from "./utils/xrpAppErrors";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly returnChainCode?: boolean;
  readonly useEd25519?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
  readonly chainCode?: string;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, XrpErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    XrpErrorCodes
  >(XRP_APP_ERRORS, XrpAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    // XRP get address command
    // CLA: 0xe0, INS: 0x02
    // P1: 0x00 (no display) or 0x01 (display on device)
    // P2: curveMask | chainCode flag
    //     - curveMask: 0x80 for ed25519, 0x40 for secp256k1
    //     - chainCode: 0x01 to include chain code

    const curveMask = this._args.useEd25519 ? 0x80 : 0x40;
    const chainCodeFlag = this._args.returnChainCode ? 0x01 : 0x00;

    const builder = new ApduBuilder({
      cla: 0xe0,
      ins: 0x02,
      p1: this._args.checkOnDevice ? 0x01 : 0x00,
      p2: curveMask | chainCodeFlag,
    });

    // Parse derivation path and add to APDU
    const paths = DerivationPathUtils.splitPath(this._args.derivationPath);

    // First byte is the number of path components
    builder.add8BitUIntToData(paths.length);

    // Add each path component as 4-byte big-endian
    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, XrpErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response format:
        // [publicKeyLength, publicKey..., addressLength, address..., chainCode (32 bytes if requested)]

        const publicKeyLength = parser.extract8BitUInt();
        if (publicKeyLength === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError(
              "Cannot extract public key length",
            ),
          });
        }

        const publicKeyBytes = parser.extractFieldByLength(publicKeyLength);
        if (!publicKeyBytes) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        const addressLength = parser.extract8BitUInt();
        if (addressLength === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract address length"),
          });
        }

        const addressBytes = parser.extractFieldByLength(addressLength);
        if (!addressBytes) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract address"),
          });
        }

        // Convert address bytes to ASCII string
        const address = new TextDecoder("ascii").decode(addressBytes);

        // Chain code is 32 bytes if requested
        let chainCode: string | undefined;
        if (this._args.returnChainCode) {
          const chainCodeBytes = parser.extractFieldByLength(32);
          if (chainCodeBytes) {
            chainCode = Buffer.from(chainCodeBytes).toString("hex");
          }
        }

        return CommandResultFactory({
          data: {
            publicKey: Buffer.from(publicKeyBytes).toString("hex"),
            address,
            chainCode,
          },
        });
      },
    );
  }
}
