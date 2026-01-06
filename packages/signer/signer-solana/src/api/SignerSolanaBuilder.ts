import {
  type ContextModule,
  ContextModuleBuilder,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerSolana } from "@internal/DefaultSignerSolana";

type SignerSolanaBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  originToken?: string;
};

/**
 * Builder for the `SignerSolana` class.
 *
 * @example
 * ```
 * const signer = new SignerSolanaBuilder({ dmk, sessionId })
 *  .build();
 * ```
 */
export class SignerSolanaBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;
  private _customContextModule: ContextModule | undefined;
  private _originToken: string | undefined;

  constructor({
    dmk,
    sessionId,
    originToken,
  }: SignerSolanaBuilderConstructorArgs) {
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
   * Build the solana signer
   *
   * @returns the solana signer
   */
  public build() {
    return new DefaultSignerSolana({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule:
        this._customContextModule ??
        new ContextModuleBuilder({
          originToken: this._originToken,
          loggerFactory: (tag: string) =>
            this._dmk.getLoggerFactory()(`SignerSolanaContextModule-${tag}`),
        }).build(),
    });
  }
}
