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
  NEAR_APP_ERRORS,
  NearAppCommandErrorFactory,
  type NearErrorCodes,
} from "./utils/nearAppErrors";

// NEAR APDU constants
const CLA = 0x80;
const INS_GET_PUBLIC_KEY = 0x04;
const INS_GET_ADDRESS = 0x05;
const NETWORK_ID = 0x57; // 'W'

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
  readonly address: string;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, NearErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    NearErrorCodes
  >(NEAR_APP_ERRORS, NearAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice } = this._args;

    // Use INS_GET_ADDRESS if verifying on device, otherwise INS_GET_PUBLIC_KEY
    const ins = checkOnDevice ? INS_GET_ADDRESS : INS_GET_PUBLIC_KEY;
    
    // P1: 1 if silent (no verify), 0 if verify
    // For INS_GET_ADDRESS, P1 is always 0
    const p1 = checkOnDevice ? 0x00 : 0x01;

    const builder = new ApduBuilder({
      cla: CLA,
      ins,
      p1,
      p2: NETWORK_ID,
    });

    // Build BIP32 path bytes
    const paths = DerivationPathUtils.splitPath(derivationPath);
    
    // Path format: number of elements (4 bytes) + each element (4 bytes each)
    builder.add32BitUIntToData(paths.length);
    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, NearErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response: Public key (32 bytes for Ed25519)
        const publicKey = parser.extractFieldByLength(32);

        if (publicKey === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        // Address is the hex representation of the public key
        const address = Array.from(publicKey)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return CommandResultFactory({
          data: {
            publicKey,
            address,
          },
        });
      },
    );
  }
}
