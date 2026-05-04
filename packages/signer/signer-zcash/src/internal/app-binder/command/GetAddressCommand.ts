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

import {
  INS,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";

const CHAIN_CODE_LENGTH = 32;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
  readonly address: string;
  readonly chainCode: Uint8Array;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, ZcashErrorCodes>
{
  readonly name = "GetAddress";

  private readonly args: GetAddressCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getAddressArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS.GET_WALLET_PUBLIC_KEY,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(getAddressArgs);

    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const publicKeyLength = parser.extract8BitUInt();
      if (publicKeyLength === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key length is missing"),
        });
      }

      if (parser.testMinimalLength(publicKeyLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }

      const publicKey = parser.extractFieldByLength(publicKeyLength);
      if (publicKey === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unable to extract public key"),
        });
      }

      const addressLength = parser.extract8BitUInt();
      if (addressLength === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Address length is missing"),
        });
      }

      if (parser.testMinimalLength(addressLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Address is missing"),
        });
      }

      const addressBytes = parser.extractFieldByLength(addressLength);
      if (addressBytes === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unable to extract address"),
        });
      }

      const address = parser.encodeToString(addressBytes);

      if (parser.testMinimalLength(CHAIN_CODE_LENGTH) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Chain code is missing"),
        });
      }

      const chainCode = parser.extractFieldByLength(CHAIN_CODE_LENGTH);
      if (chainCode === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unable to extract chain code"),
        });
      }

      return CommandResultFactory({
        data: {
          publicKey,
          address,
          chainCode,
        },
      });
    });
  }
}
