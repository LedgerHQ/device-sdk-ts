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

import { type PubKey } from "@api/model/PubKey";
import {
  COSMOS_APP_ERRORS,
  CosmosAppCommandErrorFactory,
  type CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly hrp: string;
  readonly checkOnDevice: boolean;
  readonly skipOpenApp: boolean;
};

export type GetAddressCommandResponse = PubKey;

export const COSMOS_GET_ADDRESS_APDU_HEADER = (p1: number) => ({
  cla: 0x55,
  ins: 0x04,
  p1,
  p2: 0x00,
});

export const P1_CHECK_ON_DEVICE = 0x01;
export const P1_NO_CHECK_ON_DEVICE = 0x00;

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, CosmosErrorCodes>
{
  readonly name = "GetAddress";

  private readonly args: GetAddressCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    CosmosErrorCodes
  >(COSMOS_APP_ERRORS, CosmosAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder(
      COSMOS_GET_ADDRESS_APDU_HEADER(
        this.args.checkOnDevice ? P1_CHECK_ON_DEVICE : P1_NO_CHECK_ON_DEVICE,
      ),
    );

    apduBuilder.encodeInLVFromAscii(this.args.hrp);

    const derivationPath = DerivationPathUtils.splitPath(
      this.args.derivationPath,
    );

    if (derivationPath.length !== 5) {
      throw new Error(
        `GetAddressCommand: expected cosmos style number of path elements, got ${derivationPath.length}`,
      );
    }

    const view = new DataView(new ArrayBuffer(20));
    for (let i = 0; i < derivationPath.length; i++) {
      const raw = derivationPath[i]! & 0x7fffffff;
      const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;
      view.setUint32(i * 4, hardened, true);
    }
    apduBuilder.addBufferToData(new Uint8Array(view.buffer));

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, CosmosErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const publicKey = apduParser.extractFieldByLength(33);
      const remaining = apduParser.getUnparsedRemainingLength();
      const address = apduParser.extractFieldByLength(remaining);

      if (publicKey === undefined || address === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }

      const trimmedAddrBytes = address.filter((b) => b !== 0x00);
      const bech32Address = apduParser.encodeToString(trimmedAddrBytes);

      return CommandResultFactory({
        data: {
          publicKey,
          address: bech32Address,
        },
      });
    });
  }
}
