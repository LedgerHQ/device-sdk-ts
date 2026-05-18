import {
  type ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerConcordium } from "@internal/DefaultSignerConcordium";

type SignerConcordiumBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class SignerConcordiumBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private _customContextModule?: ContextModule;

  constructor({ dmk, sessionId }: SignerConcordiumBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Override the default context module
   *
   * @param contextModule
   * @returns this
   */
  public withContextModule(contextModule: ContextModule): this {
    this._customContextModule = contextModule;
    return this;
  }

  public build() {
    const contextModule =
      this._customContextModule ??
      new ContextModuleBuilder({
        loggerFactory: (tag: string) =>
          this._dmk.getLoggerFactory()(["ContextModule", tag]),
      })
        .setChain(ContextModuleChainID.Concordium)
        .build();

    return new DefaultSignerConcordium({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule,
    });
  }
}
