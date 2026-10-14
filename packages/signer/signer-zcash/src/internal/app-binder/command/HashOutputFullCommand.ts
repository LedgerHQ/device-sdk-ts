import {
  type HashOutputFullCommandArgs,
  LegacyHashOutputFullCommand,
} from "@ledgerhq/signer-btc-legacy-core";

import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { ZCASH_LEGACY_PROFILE } from "@internal/app-binder/zcashLegacyProfile";

export {
  type HashOutputFullCommandArgs,
  type HashOutputFullCommandResponse,
} from "@ledgerhq/signer-btc-legacy-core";

export class HashOutputFullCommand extends LegacyHashOutputFullCommand<ZcashErrorCodes> {
  constructor(args: HashOutputFullCommandArgs) {
    super(args, ZCASH_LEGACY_PROFILE.errors);
  }
}
