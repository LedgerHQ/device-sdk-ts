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
  VECHAIN_APP_ERRORS,
  VechainAppCommandErrorFactory,
  type VechainErrorCodes,
} from "./utils/vechainAppErrors";

const CLA = 0xe0;
const INS_GET_ADDRESS = 0x02;

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
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, VechainErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    VechainErrorCodes
  >(VECHAIN_APP_ERRORS, VechainAppCommandErrorFactory);

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

    // Path format: number of elements (1 byte) + elements (4 bytes each, big-endian)
    const paths = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(paths.length);

    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, VechainErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // First byte is public key length
        const publicKeyLength = parser.extract8BitUInt();
        if (publicKeyLength === undefined || publicKeyLength === 0) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Invalid public key length"),
          });
        }

        const publicKeyBytes = parser.extractFieldByLength(publicKeyLength);
        if (publicKeyBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        const publicKey = Array.from(publicKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Next byte is address length
        const addressLength = parser.extract8BitUInt();
        if (addressLength === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Invalid address length"),
          });
        }

        const addressBytes = parser.extractFieldByLength(addressLength);
        if (addressBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract address"),
          });
        }

        const address = "0x" + new TextDecoder().decode(addressBytes).toLowerCase();

        // Chain code is 32 bytes if requested
        const remainingLen = parser.getUnparsedRemainingLength();
        let chainCode: string | undefined;
        if (remainingLen >= 32) {
          const chainCodeBytes = parser.extractFieldByLength(32);
          if (chainCodeBytes) {
            chainCode = Array.from(chainCodeBytes)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          }
        }

        return CommandResultFactory({
          data: { publicKey, address, chainCode },
        });
      },
    );
  }
}
