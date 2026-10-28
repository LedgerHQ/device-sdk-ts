import {
  type ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type SolanaAddressBook } from "@api/model/SolanaAddressBook";
import { type SolanaSignerFeaturesNames } from "@internal/app-binder/SolanaApplicationResolver";
import { DefaultSignerSolana } from "@internal/DefaultSignerSolana";

type SignerSolanaBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  originToken?: string;
  solanaRPCURL?: string;
  disabledFeatures?: ReadonlyArray<SolanaSignerFeaturesNames>;
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
  private _addressBook: SolanaAddressBook | undefined;
  private readonly _solanaRPCURL: string | undefined;
  private readonly _disabledFeatures:
    | ReadonlyArray<SolanaSignerFeaturesNames>
    | undefined;

  constructor({
    dmk,
    sessionId,
    originToken,
    solanaRPCURL,
    disabledFeatures,
  }: SignerSolanaBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
    this._originToken = originToken;
    this._solanaRPCURL = solanaRPCURL;
    this._disabledFeatures = disabledFeatures;
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
   * Provide the user's address book, so the device shows a saved contact name
   * in place of the raw recipient address when it reviews a transaction.
   *
   * - The snapshot must be complete, and it is read as-is: the signer neither
   *   mutates nor persists it. Build a new signer to pick up later changes.
   * - Only Solana entries belong here, each with its base58 wallet public key.
   * - Best effort: a recipient that does not match, an app too old to support
   *   contacts (Solana app 1.19.0, any model but Nano S) or a contact the
   *   device rejects leave the transaction signing against the raw address.
   *
   * See the "Address book" section of the README for the matching rules.
   *
   * @param addressBook a complete Solana address-book snapshot
   * @returns this
   */
  withAddressBook(addressBook: SolanaAddressBook) {
    this._addressBook = addressBook;
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
      disabledFeatures: this._disabledFeatures,
      addressBook: this._addressBook,
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
