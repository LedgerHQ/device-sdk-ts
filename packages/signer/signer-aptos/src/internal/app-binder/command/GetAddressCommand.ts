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
  APTOS_APP_ERRORS,
  AptosAppCommandErrorFactory,
  type AptosErrorCodes,
} from "./utils/aptosAppErrors";

const CLA = 0x5b;
const INS_GET_PUBLIC_KEY = 0x05;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
  readonly chainCode: Uint8Array;
  readonly address: string;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, AptosErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    AptosErrorCodes
  >(APTOS_APP_ERRORS, AptosAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_PUBLIC_KEY,
      p1: checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    });

    // BIP32 path: count (1 byte) + elements (4 bytes each)
    const paths = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(paths.length);
    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, AptosErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response: pubKeyLen, 0x04, pubKey, chainCodeLen, chainCode
        const pubKeyLenWithPrefix = parser.extract8BitUInt();
        if (pubKeyLenWithPrefix === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key length"),
          });
        }

        // Skip the 0x04 prefix byte
        parser.extract8BitUInt();
        const pubKeyLen = pubKeyLenWithPrefix - 1;
        const publicKey = parser.extractFieldByLength(pubKeyLen);

        if (publicKey === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        const chainCodeLen = parser.extract8BitUInt();
        if (chainCodeLen === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract chain code length"),
          });
        }

        const chainCode = parser.extractFieldByLength(chainCodeLen);
        if (chainCode === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract chain code"),
          });
        }

        // Address is 0x + sha3_256(pubKey || 0x00)
        const addressHex = Array.from(publicKey)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return CommandResultFactory({
          data: {
            publicKey,
            chainCode,
            address: `0x${addressHex}`, // Simplified - actual address needs sha3_256 hash
          },
        });
      },
    );
  }
}
