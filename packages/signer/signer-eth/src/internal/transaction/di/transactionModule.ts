import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { EthersRawTransactionMapper } from "@internal/transaction/service/mapper/EthersRawTransactionMapper";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { SignTransactionUseCase } from "@internal/transaction/use-case/SignTransactionUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind(transactionTypes.TransactionMapperService).to(
      TransactionMapperService,
    );
    bind(transactionTypes.TransactionParserService).to(
      TransactionParserService,
    );
    bind(transactionTypes.TransactionMappers).to(EthersRawTransactionMapper);
  });
