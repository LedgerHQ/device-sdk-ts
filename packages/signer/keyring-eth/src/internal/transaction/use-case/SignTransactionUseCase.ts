import type { ContextModule } from "@ledgerhq/context-module";
import { inject, injectable } from "inversify";

import { Signature } from "@api/model/Signature";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";
import { externalTypes } from "@internal/externalTypes";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

@injectable()
export class SignTransactionUseCase {
  // @ts-expect-error temporary ignore
  private _contextModule: ContextModule;
  // @ts-expect-error temporary ignore
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
    transaction: Transaction,
    _options?: TransactionOptions,
  ): Promise<Signature> {
    // TODO: 1- map the transaction to TransactionSubset from a Mapper module
    // 2- fetch the challenge from the app binder
    // 3- fetch ClearSignContext[] from the context module
    // 4- call app binding provides for each ClearSignContext
    // 5- then sign the transaction and return the signature

    // @ts-expect-error temporary ignore
    const _subset = this._mapper.mapTransactionToSubset(transaction);

    /**
    _subset;
    this._contextModule;
    this._appBinding;
    */

    return Promise.resolve({} as Signature);
  }
}
