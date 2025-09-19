import { ContainerModule } from "inversify";

import { HttpCalldataDescriptorDataSource } from "@/calldata/data/HttpCalldataDescriptorDataSource";
import { calldataTypes } from "@/calldata/di/calldataTypes";
import { CalldataContextLoader } from "@/calldata/domain/CalldataContextLoader";
import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";

export const calldataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(calldataTypes.DappCalldataDescriptorDataSource).toDynamicValue(
      (context) =>
        new HttpCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          "dapps",
        ),
    );
    bind(calldataTypes.TokenCalldataDescriptorDataSource).toDynamicValue(
      (context) =>
        new HttpCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          "tokens",
        ),
    );
    bind(calldataTypes.CalldataContextLoader).to(CalldataContextLoader);
  });
