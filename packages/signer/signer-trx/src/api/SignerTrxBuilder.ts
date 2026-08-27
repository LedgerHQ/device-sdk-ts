import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type TronAddressBook } from "@api/model/TronAddressBook";
import { DefaultSignerTrx } from "@internal/DefaultSignerTrx";

type SignerTrxBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerTrx` class.
 *
 * @example
 * ```
 * const signer = new SignerTrxBuilder({ dmk, sessionId })
 *  .build();
 * ```
 */
export class SignerTrxBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private _addressBook: TronAddressBook | undefined;

  constructor({ dmk, sessionId }: SignerTrxBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Provide the Tron-compatible address book used to clear-sign contact names.
   *
   * The snapshot must be complete: the signer neither mutates nor persists it,
   * and reads it as-is. Rebuild the signer to pick up later changes.
   *
   * @param addressBook a complete Tron address-book snapshot
   * @returns this
   */
  withAddressBook(addressBook: TronAddressBook) {
    this._addressBook = addressBook;
    return this;
  }

  /**
   * Build the Tron signer instance
   *
   * @returns the Tron signer instance
   */

  public build() {
    return new DefaultSignerTrx({
      dmk: this._dmk,
      sessionId: this._sessionId,
      addressBook: this._addressBook,
    });
  }
}
