import {
  type ContextModule,
  ContextModuleBuilder,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerCosmos } from "@internal/DefaultSignerCosmos";

type SignerCosmosBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  originToken?: string;
};

/**
 * Builder for the `SignerCosmos` class.
 *
 * @example
 * ```
 * const signer = new SignerCosmosBuilder({ dmk, sessionId })
 *  .build();
 * ```
 */
export class SignerCosmosBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;
  private _customContextModule: ContextModule | undefined;
  private _originToken: string | undefined;

  constructor({
    dmk,
    sessionId,
    originToken,
  }: SignerCosmosBuilderConstructorArgs) {
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
   * Build the cosmos signer
   *
   * @returns the cosmos signer
   */
  public build() {
    return new DefaultSignerCosmos({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule:
        this._customContextModule ??
        new ContextModuleBuilder({ originToken: this._originToken }).build(),
    });
  }
}
