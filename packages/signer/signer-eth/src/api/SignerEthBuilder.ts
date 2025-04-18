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
   * Build the ethereum signer
   *
   * @returns the ethereum signer
   */
  public build() {
    const contextModule =
      this._customContextModule ??
      new ContextModuleBuilder({ originToken: this._originToken }).build();

    return new DefaultSignerEth({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule,
    });
  }
}
