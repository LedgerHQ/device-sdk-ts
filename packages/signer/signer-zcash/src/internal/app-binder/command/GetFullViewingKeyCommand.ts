import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  INS,
  P1_VK,
  P2_VK,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";

export type ZcashFvkP2 = (typeof P2_VK)[keyof typeof P2_VK];

export type GetFullViewingKeyCommandArgs = {
  /** When true, P1=CONTINUE and APDU data must be empty. */
  readonly isContinue: boolean;
  /** See app `P2VkMode` (UFVK string vs raw Orchard FVK bytes). */
  readonly p2: ZcashFvkP2;
  /** Required for the first exchange only. */
  readonly derivationPath?: string;
};

/**
 * One GET_VK APDU. Response is a single chunk; the host task concatenates
 * until the last chunk has length < `VK_RESPONSE_CHUNK_SIZE` (255).
 */
export type GetFullViewingKeyCommandResponse = {
  readonly data: Uint8Array;
};

export class GetFullViewingKeyCommand
  implements
    Command<
      GetFullViewingKeyCommandResponse,
      GetFullViewingKeyCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "GetFullViewingKey";
  private readonly errorHelper = new CommandErrorHelper<
    GetFullViewingKeyCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);
  private readonly args: GetFullViewingKeyCommandArgs;

  constructor(args: GetFullViewingKeyCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    if (!this.args.isContinue && this.args.derivationPath === undefined) {
      throw new Error(
        "derivationPath is required for the first GetFullViewingKey APDU",
      );
    }

    const p1 = this.args.isContinue ? P1_VK.CONTINUE : P1_VK.FIRST;

    const getVkArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS.GET_VK,
      p1,
      p2: this.args.p2,
    };

    const builder = new ApduBuilder(getVkArgs);

    if (!this.args.isContinue && this.args.derivationPath !== undefined) {
      const path = DerivationPathUtils.splitPath(this.args.derivationPath);
      builder.add8BitUIntToData(path.length);
      path.forEach((element) => {
        builder.add32BitUIntToData(element);
      });
    }

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetFullViewingKeyCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() =>
      CommandResultFactory({ data: { data: new Uint8Array(response.data) } }),
    );
  }
}

export function zcashFvkP2FromMode(
  mode: "ufvk" | "orchardFvk",
): (typeof P2_VK)[keyof typeof P2_VK] {
  return mode === "orchardFvk" ? P2_VK.ORCHARD_FVK : P2_VK.UFVK;
}
