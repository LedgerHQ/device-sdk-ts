import {
  type Apdu,
  APDU_MAX_PAYLOAD,
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

import { ZCASH_CLA } from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";

const GET_SHIELDED_ADDRESS_INS = 0x51;

export type GetShieldedAddressCommandArgs = {
  readonly transparentDerivationPath: string;
  readonly orchardDerivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetShieldedAddressCommandResponse = {
  readonly address: string;
};

export class GetShieldedAddressCommand
  implements
    Command<
      GetShieldedAddressCommandResponse,
      GetShieldedAddressCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "GetShieldedAddress";

  private readonly args: GetShieldedAddressCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetShieldedAddressCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(args: GetShieldedAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: GET_SHIELDED_ADDRESS_INS,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(apduArgs);

    const orchardPath = DerivationPathUtils.splitPath(
      this.args.orchardDerivationPath,
    );
    const transparentPath = DerivationPathUtils.splitPath(
      this.args.transparentDerivationPath,
    );

    [orchardPath, transparentPath].forEach((path) => {
      builder.add8BitUIntToData(path.length);
      path.forEach((element) => {
        builder.add32BitUIntToData(element);
      });
    });

    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetShieldedAddressCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      // A unified address with a single Orchard receiver is ~106 bytes, well under
      // APDU_MAX_PAYLOAD (255). An exactly-full frame means the firmware changed
      // and now returns a longer payload than expected.
      if (apduResponse.data.length === APDU_MAX_PAYLOAD) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Response requires continuation which is not supported",
          ),
        });
      }

      const parser = new ApduParser(apduResponse);

      const addressLength = parser.extract16BitUInt();
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

      if (parser.testMinimalLength(1)) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Unexpected trailing bytes in response",
          ),
        });
      }

      let address: string;
      try {
        address = new TextDecoder("utf-8", { fatal: true }).decode(
          addressBytes,
        );
      } catch {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Address is not valid UTF-8"),
        });
      }

      return CommandResultFactory({ data: { address } });
    });
  }
}
