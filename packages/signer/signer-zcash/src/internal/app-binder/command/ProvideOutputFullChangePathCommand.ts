import {
  LegacyProvideOutputFullChangePathCommand,
  type ProvideOutputFullChangePathCommandArgs,
} from "@ledgerhq/signer-btc-legacy-core";

import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { ZCASH_LEGACY_PROFILE } from "@internal/app-binder/zcashLegacyProfile";

export {
  type ProvideOutputFullChangePathCommandArgs,
  type ProvideOutputFullChangePathCommandResponse,
} from "@ledgerhq/signer-btc-legacy-core";

export class ProvideOutputFullChangePathCommand extends LegacyProvideOutputFullChangePathCommand<ZcashErrorCodes> {
  constructor(args: ProvideOutputFullChangePathCommandArgs) {
    super(args, ZCASH_LEGACY_PROFILE.errors);
  }
}
