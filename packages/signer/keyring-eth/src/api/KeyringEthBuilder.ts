import {
  type ContextModule,
  ContextModuleBuilder,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultKeyringEth } from "@internal/DefaultKeyringEth";

type KeyringEthBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `KeyringEth` class.
 *
 * @example
 * ```
 * const dmk = new KeyringEthBuilder(dmk)
 *  .build();
 * ```
 */
export class KeyringEthBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;
  private _contextModule: ContextModule;

  constructor({ dmk, sessionId }: KeyringEthBuilderConstructorArgs) {
    this._dmk = dmk;
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
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule: this._contextModule,
    });
  }
}
