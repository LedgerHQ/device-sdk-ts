import {
  type ContextModule,
  ContextModuleBuilder,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerSui } from "@internal/DefaultSignerSui";

type SignerSuiBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  originToken?: string;
};

export class SignerSuiBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;
  private _customContextModule: ContextModule | undefined;
  private _originToken: string | undefined;

  constructor({
    dmk,
    sessionId,
    originToken,
  }: SignerSuiBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
    this._originToken = originToken;
  }

  withContextModule(contextModule: ContextModule) {
    this._customContextModule = contextModule;
    return this;
  }

  public build() {
    return new DefaultSignerSui({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule:
        this._customContextModule ??
        new ContextModuleBuilder({
          originToken: this._originToken,
          loggerFactory: (tag: string) =>
            this._dmk.getLoggerFactory()(["ContextModule", tag]),
        }).build(),
    });
  }
}
