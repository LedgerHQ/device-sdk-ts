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
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronAppErrors";

// Tron APDU constants
const CLA = 0xe0;
const INS_ADDRESS = 0x02;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, TronErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_ADDRESS,
      p1: checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    });

    // Build derivation path: paths_count (1 byte) + paths (4 bytes each big endian)
    const paths = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(paths.length);
    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response format:
        // publicKeyLength (1 byte), publicKey (publicKeyLength bytes),
        // addressLength (1 byte), address (addressLength bytes, ASCII)
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

        // Convert publicKey to hex and address to ASCII
        const publicKey = Array.from(publicKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const address = new TextDecoder("ascii").decode(addressBytes);

        return CommandResultFactory({
          data: {
            publicKey,
            address,
          },
        });
      },
    );
  }
}
