import {
  type GetAddressCommandArgs,
  LegacyGetAddressCommand,
} from "@ledgerhq/signer-btc-legacy-core";

import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { ZCASH_LEGACY_PROFILE } from "@internal/app-binder/zcashLegacyProfile";

export {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@ledgerhq/signer-btc-legacy-core";

export class GetAddressCommand extends LegacyGetAddressCommand<ZcashErrorCodes> {
  constructor(args: GetAddressCommandArgs) {
    super(args, ZCASH_LEGACY_PROFILE.errors);
  }
}
