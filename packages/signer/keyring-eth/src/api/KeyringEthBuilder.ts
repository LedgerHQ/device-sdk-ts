import { ContextModule, ContextModuleBuilder } from "@ledgerhq/context-module";
import { DeviceSdk } from "@ledgerhq/device-sdk-core";

import { DefaultKeyringEth } from "@internal/DefaultKeyringEth";
import { DeviceSessionId } from "@ledgerhq/device-sdk-core/lib/cjs/index.js";

type KeyringEthBuilderConstructorArgs = {
  sdk: DeviceSdk;
  sessionId: DeviceSessionId;
};

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
  private _sessionId: DeviceSessionId;
  private _contextModule: ContextModule;

  constructor({ sdk, sessionId }: KeyringEthBuilderConstructorArgs) {
    this._sdk = sdk;
    this._sessionId = sessionId;
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
      sessionId: this._sessionId,
      contextModule: this._contextModule,
    });
  }
}
