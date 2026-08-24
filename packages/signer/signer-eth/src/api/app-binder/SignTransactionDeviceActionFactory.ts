import { type ContextModule } from "@ledgerhq/context-module";
import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { type TransactionOptions } from "@api/model/TransactionOptions";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction";
import { EthersTransactionMapperService } from "@internal/transaction/service/mapper/EthersTransactionMapperService";
import { TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

export const SignTransactionDeviceActionFactory = (args: {
  derivationPath: string;
  transaction: Uint8Array;
  contextModule: ContextModule;
  options?: TransactionOptions;
  inspect?: boolean;
  loggerFactory?: (tag: string) => LoggerPublisherService;
}): SignTransactionDeviceAction =>
  new SignTransactionDeviceAction({
    input: {
      derivationPath: args.derivationPath,
      transaction: args.transaction,
      contextModule: args.contextModule,
      options: args.options ?? {},
      mapper: new EthersTransactionMapperService(),
      parser: new TransactionParserService(),
    },
    inspect: args.inspect,
    loggerFactory: args.loggerFactory,
  });
