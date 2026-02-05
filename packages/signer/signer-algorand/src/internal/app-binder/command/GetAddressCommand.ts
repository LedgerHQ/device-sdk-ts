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
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ALGORAND_APP_ERRORS,
  AlgorandAppCommandErrorFactory,
  type AlgorandErrorCodes,
} from "./utils/algorandAppErrors";

// Algorand APDU constants
const CLA = 0x80;
const INS_GET_PUBLIC_KEY = 0x03;
const P1_WITH_REQUEST_USER_APPROVAL = 0x80;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
};

/**
 * Extracts the account index from a BIP32 derivation path.
 * Algorand uses only the account index (3rd element: 44'/283'/X'/0/0)
 */
function extractAccountIndex(derivationPath: string): number {
  const parts = derivationPath.replace(/'/g, "").split("/");
  // Remove 'm' if present
  const indexParts = parts[0] === "m" ? parts.slice(1) : parts;
  // Account index is the 3rd element (index 2)
  const accountIndexStr = indexParts[2];
  if (indexParts.length < 3 || accountIndexStr === undefined) {
    throw new Error("Invalid derivation path for Algorand");
  }
  return parseInt(accountIndexStr, 10);
}

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, AlgorandErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    AlgorandErrorCodes
  >(ALGORAND_APP_ERRORS, AlgorandAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice } = this._args;

    // Extract account index from derivation path
    const accountIndex = extractAccountIndex(derivationPath);

    // Build APDU with account index as 4-byte big-endian
    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_PUBLIC_KEY,
      p1: checkOnDevice ? P1_WITH_REQUEST_USER_APPROVAL : 0x00,
      p2: 0x00,
    });

    // Add account index as 4 bytes big-endian
    builder.add32BitUIntToData(accountIndex);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, AlgorandErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response is 32 bytes of public key
        const publicKey = parser.extractFieldByLength(32);

        if (publicKey === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        return CommandResultFactory({
          data: {
            publicKey,
          },
        });
      },
    );
  }
}
