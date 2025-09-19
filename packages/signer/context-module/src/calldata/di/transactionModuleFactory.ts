import { ContainerModule } from "inversify";

import { HttpCalldataDescriptorDataSource } from "@/calldata/data/HttpCalldataDescriptorDataSource";
import { transactionTypes } from "@/calldata/di/transactionTypes";
import { TransactionContextLoader } from "@/calldata/domain/TransactionContextLoader";
import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";

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
