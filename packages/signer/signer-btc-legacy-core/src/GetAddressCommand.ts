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
import { Maybe } from "purify-ts";

import { BTC_LEGACY_CLA } from "./apduHeader";
import { type LegacyErrorConfig } from "./errors";
import { CommandErrorHelper, DerivationPathUtils } from "./signerUtils";

const CHAIN_CODE_LENGTH = 32;
const GET_ADDRESS_INS = 0x40;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  /** P2: address format (0x00 legacy, 0x01 p2sh, 0x02 bech32, 0x03 cashaddr). */
  readonly addressFormat?: number;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
  readonly address: string;
  readonly chainCode: Uint8Array;
};

export class LegacyGetAddressCommand<ErrorCodes extends string>
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, ErrorCodes>
{
  readonly name = "GetAddress";
  private readonly errorHelper: CommandErrorHelper<
    GetAddressCommandResponse,
    ErrorCodes
  >;

  constructor(
    private readonly args: GetAddressCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: GET_ADDRESS_INS,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: this.args.addressFormat ?? 0x00,
    };
    const builder = new ApduBuilder(apduArgs);
    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, ErrorCodes> {
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
