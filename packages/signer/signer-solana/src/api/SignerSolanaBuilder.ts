import {
  type ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
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
  solanaRPCURL?: string;
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
  private readonly _solanaRPCURL: string | undefined;

  constructor({
    dmk,
    sessionId,
    originToken,
    solanaRPCURL,
  }: SignerSolanaBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
    this._originToken = originToken;
    this._solanaRPCURL = solanaRPCURL;
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
      solanaRPCURL: this._solanaRPCURL,
      contextModule:
        this._customContextModule ??
        new ContextModuleBuilder({
          originToken: this._originToken,
          loggerFactory: (tag: string) =>
            this._dmk.getLoggerFactory()(["ContextModule", tag]),
        })
          .setChain(ContextModuleChainID.Solana)
          .build(),
    });
  }
}
