import {
  type ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type EvmAddressBook } from "@api/model/EvmAddressBook";
import { DefaultSignerEth } from "@internal/DefaultSignerEth";

type SignerEthBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  originToken?: string;
};

/**
 * Builder for the `SignerEth` class.
 *
 * @example
 * ```
 * const dmk = new SignerEthBuilder(dmk)
 *  .build();
 * ```
 */
export class SignerEthBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;
  private _customContextModule: ContextModule | undefined;
  private _originToken: string | undefined;
  private _addressBook: EvmAddressBook | undefined;

  constructor({
    dmk,
    sessionId,
    originToken,
  }: SignerEthBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
    this._originToken = originToken;
  }

  /**
   * Override the default context module
   *
   * @param contextModule
   * @returns this
   */
  withContextModule(contextModule: ContextModule) {
    this._customContextModule = contextModule;
    return this;
  }

  /**
   * Provide the EVM-compatible address book used to clear-sign contact names.
   *
   * The snapshot must be complete: the signer neither mutates nor persists it,
   * and reads it as-is. Rebuild the signer to pick up later changes.
   *
   * @param addressBook a complete EVM address-book snapshot
   * @returns this
   */
  withAddressBook(addressBook: EvmAddressBook) {
    this._addressBook = addressBook;
    return this;
  }

  /**
   * Build the ethereum signer
   *
   * @returns the ethereum signer
   */
  public build() {
    const contextModule =
      this._customContextModule ??
      new ContextModuleBuilder({
        originToken: this._originToken,
        loggerFactory: (tag: string) =>
          this._dmk.getLoggerFactory()(["ContextModule", tag]),
      })
        .setChain(ContextModuleChainID.Ethereum)
        .build();

    return new DefaultSignerEth({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule,
      addressBook: this._addressBook,
    });
  }
}
