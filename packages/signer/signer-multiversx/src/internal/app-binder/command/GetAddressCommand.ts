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
  MULTIVERSX_APP_ERRORS,
  MultiversxAppCommandErrorFactory,
  type MultiversxErrorCodes,
} from "./utils/multiversxAppErrors";

const CLA = 0xed;
const INS_GET_ADDR = 0x03;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, MultiversxErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    MultiversxErrorCodes
  >(MULTIVERSX_APP_ERRORS, MultiversxAppCommandErrorFactory);

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
  ): CommandResult<GetAddressCommandResponse, MultiversxErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength < 32) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Response too short"),
          });
        }

        // Public key is 32 bytes
        const publicKeyBytes = parser.extractFieldByLength(32);
        if (publicKeyBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        const publicKey = Array.from(publicKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Address is remaining bytes (bech32 format, erd1...)
        const remainingLen = parser.getUnparsedRemainingLength();
        let address = publicKey;
        if (remainingLen > 0) {
          const addressBytes = parser.extractFieldByLength(remainingLen);
          if (addressBytes) {
            address = new TextDecoder().decode(addressBytes);
          }
        }

        return CommandResultFactory({
          data: { publicKey, address },
        });
      },
    );
  }
}
