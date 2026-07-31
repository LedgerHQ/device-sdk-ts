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

import { type Address } from "@api/model/Address";
import {
  ICP_APP_ERRORS,
  IcpAppCommandErrorFactory,
  type IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";

import { encodeDerivationPath } from "./utils/EncodeDerivationPath";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice: boolean;
  readonly skipOpenApp: boolean;
};

export type GetAddressCommandResponse = Address;

export const icpGetAddressApduHeader = (p1: number) => ({
  cla: 0x11,
  ins: 0x01,
  p1,
  p2: 0x00,
});

export const P1_CHECK_ON_DEVICE = 0x01;
export const P1_NO_CHECK_ON_DEVICE = 0x00;
const DERIVATION_PATH_LENGTH = 5;
// GET_ADDR response is fixed-length: publicKey(65) · principal(29) · accountId(32) · principalText.
const PUBLIC_KEY_LENGTH = 65;
const PRINCIPAL_LENGTH = 29;
const ACCOUNT_ID_LENGTH = 32;

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, IcpErrorCodes>
{
  readonly name = "GetAddress";

  private readonly args: GetAddressCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    IcpErrorCodes
  >(ICP_APP_ERRORS, IcpAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder(
      icpGetAddressApduHeader(
        this.args.checkOnDevice ? P1_CHECK_ON_DEVICE : P1_NO_CHECK_ON_DEVICE,
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

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, IcpErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);

      const publicKey = apduParser.extractFieldByLength(PUBLIC_KEY_LENGTH);
      // Validate the raw principal's presence; consumers use the account identifier + textual principal.
      const rawPrincipal = apduParser.extractFieldByLength(PRINCIPAL_LENGTH);
      const accountId = apduParser.extractFieldByLength(ACCOUNT_ID_LENGTH);
      const principalText = apduParser.extractFieldByLength(
        apduParser.getUnparsedRemainingLength(),
      );

      if (
        publicKey === undefined ||
        rawPrincipal === undefined ||
        accountId === undefined ||
        accountId.length === 0 ||
        principalText === undefined ||
        principalText.length === 0
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract address"),
        });
      }

      return CommandResultFactory({
        data: {
          publicKey: apduParser.encodeToHexaString(publicKey),
          accountId: apduParser.encodeToHexaString(accountId),
          // Canonical ICP text form: dash-separated 5-char segments, no trailing dash.
          principal: apduParser
            .encodeToString(principalText)
            .replace(/(.{5})(?=.)/g, "$1-"),
        },
      });
    });
  }
}
