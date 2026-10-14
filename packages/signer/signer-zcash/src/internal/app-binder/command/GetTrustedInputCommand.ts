import {
  type GetTrustedInputCommandArgs,
  LegacyGetTrustedInputCommand,
} from "@ledgerhq/signer-btc-legacy-core";

import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { ZCASH_LEGACY_PROFILE } from "@internal/app-binder/zcashLegacyProfile";

export {
  type GetTrustedInputCommandArgs,
  type GetTrustedInputCommandResponse,
  INDEX_LOOKUP_PREFIX_LENGTH,
} from "@ledgerhq/signer-btc-legacy-core";

export class GetTrustedInputCommand extends LegacyGetTrustedInputCommand<ZcashErrorCodes> {
  constructor(args: GetTrustedInputCommandArgs) {
    super(args, ZCASH_LEGACY_PROFILE.errors);
  }
}
