import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type PublicKey } from "@api/model/PublicKey";

import {
  COSMOS_APP_ERRORS,
  CosmosAppCommandErrorFactory,
  type CosmosAppErrorCodes,
} from "./utils/CosmosAppErrors";

const PUBKEY_LENGTH = 33;

export type GetPubKeyCommandResponse = PublicKey;

export type GetPubKeyCommandArgs = {
  derivationPath: string;
  prefix: string;
  checkOnDevice: boolean;
};

export class GetPubKeyCommand
  implements
    Command<GetPubKeyCommandResponse, GetPubKeyCommandArgs, CosmosAppErrorCodes>
{
  readonly name = "getPubKey";
  private readonly errorHelper = new CommandErrorHelper<
    GetPubKeyCommandResponse,
    CosmosAppErrorCodes
  >(COSMOS_APP_ERRORS, CosmosAppCommandErrorFactory);

  args: GetPubKeyCommandArgs;

  constructor(args: GetPubKeyCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getPubKeyArgs: ApduBuilderArgs = {
      cla: 0x55,
      ins: 0x04,
      p1: this.args.checkOnDevice ? 0x01 : 0x00, // display on device
      p2: 0x00,
    };

    const builder = new ApduBuilder(getPubKeyArgs);

    // HRP
    const hrp = this.args.prefix; // e.g. "cosmos"
    if (!hrp || hrp.length === 0) {
      throw new Error("SignTransactionCommand: prefix is required");
    }

    builder.add8BitUIntToData(hrp.length);
    builder.addAsciiStringToData(hrp);

    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    if (path.length !== 5) {
      throw new Error(
        `SignTransactionCommand: expected cosmos style number of path elements, got ${path.length}`,
      );
    }

    const view = new DataView(new ArrayBuffer(20));
    for (let i = 0; i < 5; i++) {
      const raw = path[i]! & 0x7fffffff;
      const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;

      view.setUint32(i * 4, hardened, true);
    }
    builder.addBufferToData(new Uint8Array(view.buffer));

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetPubKeyCommandResponse, CosmosAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      if (!parser.testMinimalLength(PUBKEY_LENGTH)) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }

      const pkBytes = parser.extractFieldByLength(PUBKEY_LENGTH);
      if (!pkBytes) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unable to extract public key"),
        });
      }

      const remaining = parser.getUnparsedRemainingLength();
      if (remaining === 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Address is missing"),
        });
      }

      const addrBytes = parser.extractFieldByLength(remaining);
      if (!addrBytes) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unable to extract address"),
        });
      }

      const trimmedAddrBytes = addrBytes.filter((b) => b !== 0x00);
      const bech32Address = parser.encodeToString(trimmedAddrBytes);
      const publicKeyHex = parser.encodeToHexaString(pkBytes);

      return CommandResultFactory({
        data: {
          publicKey: publicKeyHex,
          address: bech32Address,
        },
      });
    });
  }
}
