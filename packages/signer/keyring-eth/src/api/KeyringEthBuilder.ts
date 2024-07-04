import { ContextModule, ContextModuleBuilder } from "@ledgerhq/context-module";
import { DeviceSdk } from "@ledgerhq/device-sdk-core";

import { DefaultKeyringEth } from "@internal/DefaultKeyringEth";

/**
 * Builder for the `KeyringEth` class.
 *
 * @example
 * ```
 * const sdk = new KeyringEthBuilder(sdk)
 *  .build();
 * ```
 */
export class KeyringEthBuilder {
  private _sdk: DeviceSdk;
  private _contextModule: ContextModule;

  constructor(sdk: DeviceSdk) {
    this._sdk = sdk;
    // default context module for ETH
    this._contextModule = new ContextModuleBuilder().build();
  }

  /**
   * Override the default context module
   *
   * @param contextModule
   * @returns this
   */
  withContextModule(contextModule: ContextModule) {
    this._contextModule = contextModule;
    return this;
  }

  /**
   * Build the ethereum keyring
   *
   * @returns the ethereum keyring
   */
  public build() {
    return new DefaultKeyringEth({
      sdk: this._sdk,
      contextModule: this._contextModule,
    });
  }
}
