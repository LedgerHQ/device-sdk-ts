import {
  type Apdu,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { ApduBuilder } from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type PubKey } from "@api/model/PubKey";
import {
  COSMOS_APP_ERRORS,
  CosmosAppCommandError,
  CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly hrp: string;
  readonly checkOnDevice: boolean;
  readonly skipOpenApp: boolean;
};

export type GetAddressCommandResponse = PubKey;

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, CosmosErrorCodes>
{
  readonly name = "GetAddress";

  private readonly args: GetAddressCommandArgs;

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder({
      cla: 0x55,
      ins: 0x04,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    });

    const derivationPath = DerivationPathUtils.splitPath(
      this.args.derivationPath,
    );

    apduBuilder.encodeInLVFromAscii(this.args.hrp);

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
    const apduParser = new ApduParser(apduResponse);
    const statusCode = apduParser.encodeToHexaString(
      apduResponse.statusCode,
      true,
    );

    if (statusCode in COSMOS_APP_ERRORS) {
      const errorStatusCode = statusCode as CosmosErrorCodes;
      return CommandResultFactory({
        error: new CosmosAppCommandError({
          ...COSMOS_APP_ERRORS[errorStatusCode],
          errorCode: errorStatusCode,
        }),
      });
    }

    const publicKey = apduParser.extractFieldByLength(33);
    const remaining = apduParser.getUnparsedRemainingLength();
    const address = apduParser.extractFieldByLength(remaining);

    if (publicKey === undefined || address === undefined) {
      return CommandResultFactory({
        error: new CosmosAppCommandError({
          message: COSMOS_APP_ERRORS[CosmosErrorCodes.DATA_INVALID].message,
          errorCode: CosmosErrorCodes.DATA_INVALID,
        }),
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
  }
}
