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
  SUI_APP_ERRORS,
  SuiAppCommandErrorFactory,
  type SuiErrorCodes,
} from "./utils/suiAppErrors";

const CLA = 0x00;
const INS_GET_PUBKEY = 0x02;
const INS_VERIFY_ADDRESS = 0x01;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, SuiErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    SuiErrorCodes
  >(SUI_APP_ERRORS, SuiAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: checkOnDevice ? INS_VERIFY_ADDRESS : INS_GET_PUBKEY,
      p1: 0x00,
      p2: 0x00,
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
  ): CommandResult<GetAddressCommandResponse, SuiErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        // Response format: 32 bytes public key + address
        if (responseLength >= 32) {
          const publicKeyBytes = parser.extractFieldByLength(32);
          if (publicKeyBytes === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract public key"),
            });
          }

          const publicKey = Array.from(publicKeyBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          // Sui address is Blake2b-256(0x00 || pubkey) with 0x prefix
          // For now, we return the address from remaining bytes if present
          const remainingLen = parser.getUnparsedRemainingLength();
          let address = `0x${publicKey}`;
          
          if (remainingLen > 0) {
            const addressBytes = parser.extractFieldByLength(remainingLen);
            if (addressBytes) {
              // Check if it's ASCII or hex
              const decoded = new TextDecoder().decode(addressBytes);
              if (decoded.startsWith("0x")) {
                address = decoded;
              } else {
                // Convert to hex
                address = `0x${Array.from(addressBytes)
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("")}`;
              }
            }
          }

          return CommandResultFactory({
            data: { publicKey, address },
          });
        }

        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract public key"),
        });
      },
    );
  }
}
