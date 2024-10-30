import {
  type ContextModule,
  ContextModuleBuilder,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerEth } from "@internal/DefaultSignerEth";

type SignerEthBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
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
  private _contextModule: ContextModule;

  constructor({ dmk, sessionId }: SignerEthBuilderConstructorArgs) {
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
   * Build the ethereum signer
   *
   * @returns the ethereum signer
   */
  public build() {
    return new DefaultSignerEth({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule: this._contextModule,
    });
  }
}
