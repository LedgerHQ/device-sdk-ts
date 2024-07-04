import type { ContextModule } from "@ledgerhq/context-module";
import { DeviceSdk } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { Signature, Transaction, TransactionOptions } from "@api/index";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class SignTransactionUseCase {
  private _contextModule: ContextModule;
  private _sdk: DeviceSdk;

  constructor(
    @inject(externalTypes.Sdk)
    sdk: DeviceSdk,
    @inject(externalTypes.ContextModule)
    contextModule: ContextModule,
  ) {
    this._contextModule = contextModule;
    this._sdk = sdk;
  }

  async execute(
    _derivationPath: string,
    _transaction: Transaction,
    _options?: TransactionOptions,
  ): Promise<Signature> {
    // TODO: 1- map the transaction to TransactionContext from a Mapper module
    // 2- fetch ClearSignContext[] from the context module
    // 3- app binding for each ClearSignContext
    // 4- then sign the transaction and return the signature

    this._contextModule;
    this._sdk;

    return Promise.resolve({} as Signature);
  }
}
