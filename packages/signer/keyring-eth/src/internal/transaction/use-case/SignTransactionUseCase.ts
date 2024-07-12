import type { ContextModule } from "@ledgerhq/context-module";
import { inject, injectable } from "inversify";

import { Signature, Transaction, TransactionOptions } from "@api/index";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";
import { externalTypes } from "@internal/externalTypes";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { TransactionMapperService } from "@internal/transaction/service/TransactionMapperService";

@injectable()
export class SignTransactionUseCase {
  private _contextModule: ContextModule;
  private _appBinding: EthAppBinder;
  private _mapper: TransactionMapperService;

  constructor(
    @inject(appBinderTypes.AppBinding)
    appBinding: EthAppBinder,
    @inject(externalTypes.ContextModule)
    contextModule: ContextModule,
    @inject(transactionTypes.TransactionMapperService)
    transactionMapperService: TransactionMapperService,
  ) {
    this._contextModule = contextModule;
    this._appBinding = appBinding;
    this._mapper = transactionMapperService;
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

    this._mapper;
    this._contextModule;
    this._appBinding;

    return Promise.resolve({} as Signature);
  }
}
