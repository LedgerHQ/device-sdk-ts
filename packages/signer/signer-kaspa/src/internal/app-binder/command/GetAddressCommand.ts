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
  KASPA_APP_ERRORS,
  KaspaAppCommandErrorFactory,
  type KaspaErrorCodes,
} from "./utils/kaspaAppErrors";

const CLA = 0xe0;
const INS_GET_ADDRESS = 0x05;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, KaspaErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    KaspaErrorCodes
  >(KASPA_APP_ERRORS, KaspaAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_ADDRESS,
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
  ): CommandResult<GetAddressCommandResponse, KaspaErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength < 34) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Response too short"),
          });
        }

        const publicKeyBytes = parser.extractFieldByLength(responseLength);
        if (publicKeyBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        const publicKey = Array.from(publicKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Extract the actual 32-byte public key (skip 2 byte header)
        const addressKey = publicKeyBytes.slice(2, 34);
        const addressHex = Array.from(addressKey)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return CommandResultFactory({
          data: { publicKey, address: `kaspa:${addressHex}` },
        });
      },
    );
  }
}
