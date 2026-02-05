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
  POLKADOT_APP_ERRORS,
  PolkadotAppCommandErrorFactory,
  type PolkadotErrorCodes,
} from "./utils/polkadotAppErrors";

const CLA = 0xf9;
const INS_GET_ADDR_ED25519 = 0x01;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly ss58Prefix?: number;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
};

export class GetAddressCommand
  implements Command<GetAddressCommandResponse, GetAddressCommandArgs, PolkadotErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    PolkadotErrorCodes
  >(POLKADOT_APP_ERRORS, PolkadotAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice, ss58Prefix = 0 } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_ADDR_ED25519,
      p1: checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    });

    // Polkadot path format: 5 elements as 32-bit LE + optional ss58 prefix
    const paths = DerivationPathUtils.splitPath(derivationPath);
    
    // Serialize path elements as little-endian
    paths.forEach((element) => {
      // Write as little-endian
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setUint32(0, element, true); // true = little-endian
      builder.addBufferToData(buf);
    });

    // Add ss58 prefix as little-endian
    const ss58Buf = new Uint8Array(4);
    new DataView(ss58Buf.buffer).setUint32(0, ss58Prefix, true);
    builder.addBufferToData(ss58Buf);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, PolkadotErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

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

        // Address is remaining bytes (ASCII)
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
