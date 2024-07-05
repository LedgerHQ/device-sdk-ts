import type { ContextModule } from "@ledgerhq/context-module";
import { inject, injectable } from "inversify";

import { Signature, Transaction, TransactionOptions } from "@api/index";
import { AppBindingEth } from "@internal/app-binding/AppBindingEth";
import { appBindingTypes } from "@internal/app-binding/di/appBindingTypes";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class SignTransactionUseCase {
  private _contextModule: ContextModule;
  private _appBinding: AppBindingEth;

  constructor(
    @inject(appBindingTypes.AppBinding)
    appBinding: AppBindingEth,
    @inject(externalTypes.ContextModule)
    contextModule: ContextModule,
  ) {
    this._contextModule = contextModule;
    this._appBinding = appBinding;
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
    this._appBinding;

    return Promise.resolve({} as Signature);
  }
}
