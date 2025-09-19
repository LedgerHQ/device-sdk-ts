import { ContainerModule } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { HttpCalldataDescriptorDataSource } from "@/transaction/data/HttpCalldataDescriptorDataSource";
import { transactionTypes } from "@/transaction/di/transactionTypes";
import { TransactionContextLoader } from "@/transaction/domain/TransactionContextLoader";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.DappCalldataDescriptorDataSource).toDynamicValue(
      (context) =>
        new HttpCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          "dapps",
        ),
    );
    bind(transactionTypes.TokenCalldataDescriptorDataSource).toDynamicValue(
      (context) =>
        new HttpCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          "tokens",
        ),
    );
    bind(transactionTypes.TransactionContextLoader).to(
      TransactionContextLoader,
    );
  });
