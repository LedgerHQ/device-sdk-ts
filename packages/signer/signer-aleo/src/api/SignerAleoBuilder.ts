import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerAleo } from "@internal/DefaultSignerAleo";

type SignerAleoBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerAleo` class.
 */
export class SignerAleoBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private _contextModule?: ContextModule;

  constructor({ dmk, sessionId }: SignerAleoBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Override the default context module for CAL token metadata.
   *
   * @param contextModule
   * @returns this
   */
  withContextModule(contextModule: ContextModule): this {
    this._contextModule = contextModule;
    return this;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerAleo({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule: this._contextModule,
    });
  }
}
