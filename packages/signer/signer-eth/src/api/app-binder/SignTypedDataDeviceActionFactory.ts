import { type ContextModule } from "@ledgerhq/context-module";
import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { type TypedData } from "@api/model/TypedData";
import { SignTypedDataDeviceAction } from "@internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction";
import { EthersTransactionMapperService } from "@internal/transaction/service/mapper/EthersTransactionMapperService";
import { TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { DefaultTypedDataParserService } from "@internal/typed-data/service/DefaultTypedDataParserService";

export const SignTypedDataDeviceActionFactory = (args: {
  derivationPath: string;
  data: TypedData;
  contextModule: ContextModule;
  skipOpenApp: boolean;
  inspect?: boolean;
  loggerFactory?: (tag: string) => LoggerPublisherService;
}): SignTypedDataDeviceAction =>
  new SignTypedDataDeviceAction({
    input: {
      derivationPath: args.derivationPath,
      data: args.data,
      contextModule: args.contextModule,
      skipOpenApp: args.skipOpenApp,
      parser: new DefaultTypedDataParserService(),
      transactionMapper: new EthersTransactionMapperService(),
      transactionParser: new TransactionParserService(),
    },
    inspect: args.inspect,
    loggerFactory: args.loggerFactory,
  });
