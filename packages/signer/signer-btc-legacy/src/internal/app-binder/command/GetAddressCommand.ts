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

import { type AddressFormat } from "@api/model/AddressOptions";
import { type LegacyErrorConfig } from "@api/model/LegacyCoinProfile";
import { BTC_LEGACY_CLA } from "@internal/app-binder/command/utils/apduHeaderUtils";

const CHAIN_CODE_LENGTH = 32;
// The app always answers an uncompressed key
const PUBLIC_KEY_LENGTH = 65;
const GET_ADDRESS_INS = 0x40;

const ADDRESS_FORMAT_P2: Record<AddressFormat, number> = {
  legacy: 0x00,
  p2sh: 0x01,
  bech32: 0x02,
  cashaddr: 0x03,
};

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly addressFormat?: AddressFormat;
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

  private readonly args: GetAddressCommandArgs;

  private readonly errorHelper: CommandErrorHelper<
    GetAddressCommandResponse,
    ErrorCodes
  >;

  constructor(
    args: GetAddressCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.args = args;
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const addressFormat = this.args.addressFormat ?? "legacy";
    // A JS caller can pass any string, such as hw-app-btc's "bech32m", and an
    // undefined P2 would be sent as 0x00: a legacy address, without an error.
    if (!Object.hasOwn(ADDRESS_FORMAT_P2, addressFormat)) {
      throw new Error(`Unsupported address format: ${addressFormat}`);
    }

    const getAddressArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: GET_ADDRESS_INS,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: ADDRESS_FORMAT_P2[addressFormat],
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

      if (publicKeyLength !== PUBLIC_KEY_LENGTH) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Expected a ${PUBLIC_KEY_LENGTH}-byte public key, got ${publicKeyLength} bytes`,
          ),
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
