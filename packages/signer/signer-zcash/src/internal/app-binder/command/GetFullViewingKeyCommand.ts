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
  P1,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";

export const P2_VK = {
  UFVK: 0x00,
  ORCHARD_FVK: 0x01,
} as const;
const GET_VK_INS = 0x50;

export type ZcashFvkP2 = (typeof P2_VK)[keyof typeof P2_VK];

export type GetFullViewingKeyCommandArgs =
  | {
      /** First GET_VK exchange: P1=FIRST and path in APDU data. */
      readonly isContinue: false;
      readonly derivationPath: string;
      /**
       * Transparent account path serialized after the orchard path for UFVK
       * export (app-zcash >= v3.8.0). Required for UFVK; unused for OrchardFvk.
       */
      readonly transparentDerivationPath?: string;
      /** See app `P2VkMode` (UFVK string vs raw Orchard FVK bytes). */
      readonly p2: ZcashFvkP2;
    }
  | {
      /** Subsequent chunk(s): P1=NEXT and empty APDU data. */
      readonly isContinue: true;
      readonly p2: ZcashFvkP2;
    };

/**
 * One GET_VK APDU. Response is a single chunk; the host task concatenates
 * until the last chunk has length < `APDU_MAX_PAYLOAD` (255).
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
    const p1 = this.args.isContinue ? P1.NEXT : P1.FIRST;

    const getVkArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: GET_VK_INS,
      p1,
      p2: this.args.p2,
    };

    const builder = new ApduBuilder(getVkArgs);

    if (!this.args.isContinue) {
      const path = DerivationPathUtils.splitPath(this.args.derivationPath);
      builder.add8BitUIntToData(path.length);
      path.forEach((element) => {
        builder.add32BitUIntToData(element);
      });

      // app-zcash >= v3.8.0 expects UFVK export to carry a second prefixed path
      // for the transparent account key (44'/133'/<account>').
      if (this.args.p2 === P2_VK.UFVK && this.args.transparentDerivationPath) {
        const transparentPath = DerivationPathUtils.splitPath(
          this.args.transparentDerivationPath,
        );
        builder.add8BitUIntToData(transparentPath.length);
        transparentPath.forEach((element) => {
          builder.add32BitUIntToData(element);
        });
      }
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
