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
  ICON_APP_ERRORS,
  IconAppCommandErrorFactory,
  type IconErrorCodes,
} from "./utils/iconAppErrors";

const CLA = 0xe0;
const INS_GET_ADDR = 0x02;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly returnChainCode?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
  readonly chainCode?: string;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, IconErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    IconErrorCodes
  >(ICON_APP_ERRORS, IconAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice, returnChainCode } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_ADDR,
      p1: checkOnDevice ? 0x01 : 0x00,
      p2: returnChainCode !== false ? 0x01 : 0x00, // Default to returning chaincode
    });

    // Build path: paths_count (1 byte) + paths (4 bytes each)
    const paths = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(paths.length);
    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, IconErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response: publicKeyLength, publicKey, addressLength, address, chainCode (32 bytes if requested)
        const publicKeyLength = parser.extract8BitUInt();
        if (publicKeyLength === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key length"),
          });
        }

        const publicKeyBytes = parser.extractFieldByLength(publicKeyLength);
        if (publicKeyBytes === undefined) {
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
        if (addressBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract address"),
          });
        }

        const publicKey = Array.from(publicKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const address = new TextDecoder().decode(addressBytes);

        // Try to extract chaincode if available
        let chainCode: string | undefined;
        const remaining = parser.getUnparsedRemainingLength();
        if (remaining >= 32) {
          const chainCodeBytes = parser.extractFieldByLength(32);
          if (chainCodeBytes) {
            chainCode = Array.from(chainCodeBytes)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          }
        }

        return CommandResultFactory({
          data: {
            publicKey,
            address,
            chainCode,
          },
        });
      },
    );
  }
}
