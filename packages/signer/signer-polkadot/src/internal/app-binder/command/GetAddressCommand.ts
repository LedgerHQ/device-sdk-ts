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
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  POLKADOT_APP_ERRORS,
  PolkadotAppCommandErrorFactory,
  type PolkadotErrorCodes,
} from "@internal/app-binder/command/utils/polkadotApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

import { encodeDerivationPath } from "./utils/EncodeDerivationPath";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly ss58Prefix: number;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
  readonly address: string;
};

export const polkadotGetAddressApduHeader = (p1: number) => ({
  cla: LEDGER_CLA,
  ins: INS.GET_ADDRESS,
  p1,
  p2: P2.ED25519,
});

export const P1_CONFIRM = 0x01;
export const P1_NO_CONFIRM = 0x00;

const DERIVATION_PATH_LENGTH = 5;
const PUBLIC_KEY_LENGTH = 32;

export class GetAddressCommand
  implements
    Command<
      GetAddressCommandResponse,
      GetAddressCommandArgs,
      PolkadotErrorCodes
    >
{
  readonly name = "GetAddress";

  private readonly args: GetAddressCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    PolkadotErrorCodes
  >(POLKADOT_APP_ERRORS, PolkadotAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder(
      polkadotGetAddressApduHeader(
        this.args.checkOnDevice ? P1_CONFIRM : P1_NO_CONFIRM,
      ),
    );

    const derivationPath = DerivationPathUtils.splitPath(
      this.args.derivationPath,
    );

    if (derivationPath.length !== DERIVATION_PATH_LENGTH) {
      throw new Error(
        `GetAddressCommand: expected ${DERIVATION_PATH_LENGTH} path elements, got ${derivationPath.length}`,
      );
    }

    const encodedDerivationPath = encodeDerivationPath(derivationPath);
    apduBuilder.addBufferToData(encodedDerivationPath);

    // SS58 prefix: 2 bytes little-endian (firmware reads sizeof(uint16_t) via memcpy on ARM LE)
    const ss58Buf = new Uint8Array(2);
    new DataView(ss58Buf.buffer).setUint16(0, this.args.ss58Prefix, true);
    apduBuilder.addBufferToData(ss58Buf);

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, PolkadotErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const publicKey = apduParser.extractFieldByLength(PUBLIC_KEY_LENGTH);
      const remaining = apduParser.getUnparsedRemainingLength();
      const address = apduParser.extractFieldByLength(remaining);

      if (publicKey === undefined || address === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }

      // Address is variable-length ASCII, no null padding (unlike Cosmos)
      const addressStr = apduParser.encodeToString(address);

      return CommandResultFactory({
        data: {
          publicKey,
          address: addressStr,
        },
      });
    });
  }
}
