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
  HELIUM_APP_ERRORS,
  HeliumAppCommandErrorFactory,
  type HeliumErrorCodes,
} from "./utils/heliumAppErrors";

const CLA = 0xe0;
const INS_GET_ADDR = 0x02;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly accountIndex?: number;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
  readonly index: number;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, HeliumErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    HeliumErrorCodes
  >(HELIUM_APP_ERRORS, HeliumAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice, accountIndex = 0 } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_ADDR,
      p1: checkOnDevice ? 0x01 : 0x00,
      p2: accountIndex,
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
  ): CommandResult<GetAddressCommandResponse, HeliumErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        const index = parser.extract8BitUInt();
        if (index === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract index"),
          });
        }

        // Address binary is 33 bytes (1 byte type + 32 bytes public key)
        const addressBin = parser.extractFieldByLength(33);
        if (addressBin === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract address"),
          });
        }

        // Extract public key (last 32 bytes of address binary)
        const publicKey = Array.from(addressBin.slice(1))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Convert address binary to base58 (simplified - actual impl needs base58 encoding)
        const addressHex = Array.from(addressBin)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return CommandResultFactory({
          data: { index, publicKey, address: addressHex },
        });
      },
    );
  }
}
