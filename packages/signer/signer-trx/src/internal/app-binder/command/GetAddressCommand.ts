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
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  CHAIN_CODE_LENGTH,
  INS,
  LEDGER_CLA,
  P2_NONE,
} from "@internal/app-binder/constants";

import { encodeDerivationPath } from "./utils/encodeDerivationPath";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronAppErrorCodes,
} from "./utils/tronApplicationErrors";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly returnChainCode?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
  readonly chainCode?: string;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, TronAppErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    TronAppErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  get args(): GetAddressCommandArgs {
    return this._args;
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.GET_ADDRESS,
      p1: this._args.checkOnDevice ? 0x01 : 0x00,
      p2: this._args.returnChainCode ? 0x01 : P2_NONE,
    };

    return new ApduBuilder(apduArgs)
      .addBufferToData(encodeDerivationPath(this._args.derivationPath))
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, TronAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const publicKeyLength = parser.extract8BitUInt();
      if (
        publicKeyLength === undefined ||
        !parser.testMinimalLength(publicKeyLength)
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }
      const publicKey = parser.encodeToHexaString(
        parser.extractFieldByLength(publicKeyLength),
      );

      const addressLength = parser.extract8BitUInt();
      if (
        addressLength === undefined ||
        !parser.testMinimalLength(addressLength)
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Tron address is missing"),
        });
      }
      // The Tron address is returned as an ASCII Base58 string, not raw bytes.
      const address = parser.encodeToString(
        parser.extractFieldByLength(addressLength),
      );

      let chainCode: string | undefined = undefined;
      if (this._args.returnChainCode) {
        if (!parser.testMinimalLength(CHAIN_CODE_LENGTH)) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Chain code is missing"),
          });
        }
        chainCode = parser.encodeToHexaString(
          parser.extractFieldByLength(CHAIN_CODE_LENGTH),
        );
      }

      return CommandResultFactory({
        data: { publicKey, address, chainCode },
      });
    });
  }
}
