import {
  LegacyStartUntrustedHashTransactionInputCommand,
  type StartUntrustedHashTransactionInputCommandArgs,
} from "@ledgerhq/signer-btc-legacy-core";

import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { ZCASH_LEGACY_PROFILE } from "@internal/app-binder/zcashLegacyProfile";

export {
  type StartUntrustedHashTransactionInputCommandArgs,
  type StartUntrustedHashTransactionInputCommandResponse,
} from "@ledgerhq/signer-btc-legacy-core";

export class StartUntrustedHashTransactionInputCommand extends LegacyStartUntrustedHashTransactionInputCommand<ZcashErrorCodes> {
  constructor(args: StartUntrustedHashTransactionInputCommandArgs) {
    super(
      args,
      ZCASH_LEGACY_PROFILE.errors,
      ZCASH_LEGACY_PROFILE.newTransactionP2,
    );
  }
}
