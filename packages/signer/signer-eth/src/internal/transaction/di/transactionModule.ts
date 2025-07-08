import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { EthersTransactionMapperService } from "@internal/transaction/service/mapper/EthersTransactionMapperService";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { SignTransactionUseCase } from "@internal/transaction/use-case/SignTransactionUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind<TransactionMapperService>(
      transactionTypes.TransactionMapperService,
    ).to(EthersTransactionMapperService);
    bind(transactionTypes.TransactionParserService).to(
      TransactionParserService,
    );
  });
