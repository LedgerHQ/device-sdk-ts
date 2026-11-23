import {
  type ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerXrp } from "@internal/DefaultSignerXrp";

type SignerXrpBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  originToken?: string;
};

/**
 * Builder for the `SignerXrp` class.
 */
export class SignerXrpBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private readonly _originToken: string | undefined;
  private _customContextModule: ContextModule | undefined;

  constructor({
    dmk,
    sessionId,
    originToken,
  }: SignerXrpBuilderConstructorArgs) {
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
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    const contextModule =
      this._customContextModule ??
      new ContextModuleBuilder({
        originToken: this._originToken,
        loggerFactory: (tag: string) =>
          this._dmk.getLoggerFactory()(["ContextModule", tag]),
      })
        .setChain(ContextModuleChainID.Xrp)
        .build();

    return new DefaultSignerXrp({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule,
    });
  }
}
