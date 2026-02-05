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
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  type HederaErrorCodes,
} from "./utils/hederaAppErrors";

const CLA = 0xe0;
const INS_GET_PUBLIC_KEY = 0x02;
const PUBLIC_KEY_LENGTH = 32;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, HederaErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_PUBLIC_KEY,
      p1: 0x01, // Always display
      p2: 0x00,
    });

    // Hedera path format: 1 byte padding + path elements (4 bytes each BE)
    const paths = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(0); // Padding byte
    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, HederaErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        const publicKeyBytes = parser.extractFieldByLength(PUBLIC_KEY_LENGTH);
        if (publicKeyBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        const publicKey = Array.from(publicKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Hedera addresses are not derivable from public keys
        // Use public key as the address representation
        return CommandResultFactory({
          data: { publicKey, address: publicKey },
        });
      },
    );
  }
}
