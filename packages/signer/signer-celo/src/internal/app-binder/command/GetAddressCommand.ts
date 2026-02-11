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
  CELO_APP_ERRORS,
  CeloAppCommandErrorFactory,
  type CeloErrorCodes,
} from "./utils/celoAppErrors";

const CLA = 0xe0;
const INS_GET_ADDRESS = 0x02;
const CHAIN_CODE_LENGTH = 32;

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
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, CeloErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    CeloErrorCodes
  >(CELO_APP_ERRORS, CeloAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice, returnChainCode } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_ADDRESS,
      p1: checkOnDevice ? 0x01 : 0x00,
      p2: returnChainCode ? 0x01 : 0x00,
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
  ): CommandResult<GetAddressCommandResponse, CeloErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        const publicKeyLength = parser.extract8BitUInt();
        if (publicKeyLength === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Public key length is missing"),
          });
        }

        const publicKeyBytes = parser.extractFieldByLength(publicKeyLength);
        if (publicKeyBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Public key is missing"),
          });
        }

        const publicKey = Array.from(publicKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const addressLength = parser.extract8BitUInt();
        if (addressLength === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Address length is missing"),
          });
        }

        const addressBytes = parser.extractFieldByLength(addressLength);
        if (addressBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Address is missing"),
          });
        }

        const address = new TextDecoder().decode(addressBytes);

        // Optionally extract chain code
        let chainCode: string | undefined;
        if (this._args.returnChainCode) {
          const chainCodeBytes = parser.extractFieldByLength(CHAIN_CODE_LENGTH);
          if (chainCodeBytes) {
            chainCode = Array.from(chainCodeBytes)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          }
        }

        return CommandResultFactory({
          data: {
            publicKey,
            address: address.startsWith("0x") ? address : `0x${address}`,
            chainCode,
          },
        });
      },
    );
  }
}
