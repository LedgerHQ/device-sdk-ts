import { type GetAddressDAReturnType } from "@ledgerhq/signer-btc-legacy-core";

import { type AddressOptions } from "@api/AddressOptions";

/** Signer for one app on the legacy Bitcoin protocol, chosen by its profile. */
export interface SignerBtcLegacy<ErrorCodes extends string> {
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType<ErrorCodes>;
}
