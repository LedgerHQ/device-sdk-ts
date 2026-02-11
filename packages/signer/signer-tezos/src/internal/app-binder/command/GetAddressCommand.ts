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
  TEZOS_APP_ERRORS,
  TezosAppCommandErrorFactory,
  TezosCurve,
  type TezosErrorCodes,
} from "./utils/tezosAppErrors";

const CLA = 0x80;
const INS_GET_ADDRESS = 0x02;
const INS_GET_ADDRESS_VERIFY = 0x03;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly curve?: TezosCurve;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, TezosErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    TezosErrorCodes
  >(TEZOS_APP_ERRORS, TezosAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice, curve = TezosCurve.ED25519 } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: checkOnDevice ? INS_GET_ADDRESS_VERIFY : INS_GET_ADDRESS,
      p1: 0x00,
      p2: curve,
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
  ): CommandResult<GetAddressCommandResponse, TezosErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        
        // First byte is public key length
        const publicKeyLength = parser.extract8BitUInt();
        if (publicKeyLength === undefined || publicKeyLength === 0) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Invalid public key"),
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

        // Address encoding requires blake2b hash - for now return public key as placeholder
        // Full address encoding would use Base58Check with curve-specific prefixes
        const address = publicKey;

        return CommandResultFactory({
          data: { publicKey, address },
        });
      },
    );
  }
}
