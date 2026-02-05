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
  CANTON_APP_ERRORS,
  CantonAppCommandErrorFactory,
  type CantonErrorCodes,
} from "./utils/cantonAppErrors";

const CLA = 0xe0;
const INS_GET_ADDR = 0x05;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, CantonErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    CantonErrorCodes
  >(CANTON_APP_ERRORS, CantonAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_ADDR,
      p1: checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    });

    const paths = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(paths.length);
    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, CantonErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response: pubkeyLen (1) + pubkey + chainCodeLen (1) + chainCode
        const pubKeyLen = parser.extract8BitUInt();
        if (pubKeyLen === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key length"),
          });
        }

        const publicKeyBytes = parser.extractFieldByLength(pubKeyLen);
        if (publicKeyBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        const publicKey = Array.from(publicKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Skip chain code for address generation
        const chainCodeLen = parser.extract8BitUInt();
        if (chainCodeLen !== undefined) {
          parser.extractFieldByLength(chainCodeLen);
        }

        // Generate Canton address from public key
        let hash = 0;
        for (let i = 0; i < publicKey.length; i++) {
          const char = publicKey.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        const address = "canton_" + Math.abs(hash).toString(16);

        return CommandResultFactory({
          data: { publicKey, address },
        });
      },
    );
  }
}
