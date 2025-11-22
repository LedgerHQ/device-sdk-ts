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
const ADDR_LENGTH = 65;

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
    builder.add8BitUIntToData(hrp.length); // HRP_LEN
    builder.addAsciiStringToData(hrp); // HRP

    const path = DerivationPathUtils.splitPath(this.args.derivationPath);

    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetPubKeyCommandResponse, CosmosAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const MIN_LENGTH = PUBKEY_LENGTH + ADDR_LENGTH;
      const parser = new ApduParser(response);

      if (!parser.testMinimalLength(MIN_LENGTH)) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Response is too short"),
        });
      }

      const pkBytes = parser.extractFieldByLength(PUBKEY_LENGTH);
      if (!pkBytes) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }

      const addrBytes = parser.extractFieldByLength(ADDR_LENGTH);
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
