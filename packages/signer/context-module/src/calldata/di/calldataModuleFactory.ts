import { ContainerModule } from "inversify";

import { HttpCalldataDescriptorDataSource } from "@/calldata/data/HttpCalldataDescriptorDataSource";
import { calldataTypes } from "@/calldata/di/calldataTypes";
import { CalldataContextLoader } from "@/calldata/domain/CalldataContextLoader";
import { configTypes } from "@/config/di/configTypes";
import { networkTypes } from "@/network/di/networkTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";

export const calldataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(calldataTypes.DappCalldataDescriptorDataSource).toDynamicValue(
      (context) =>
        new HttpCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          "dapps",
          context.get(networkTypes.NetworkClient),
        ),
    );
    bind(calldataTypes.TokenCalldataDescriptorDataSource).toDynamicValue(
      (context) =>
        new HttpCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          "tokens",
          context.get(networkTypes.NetworkClient),
        ),
    );
    bind(calldataTypes.CalldataContextLoader).to(CalldataContextLoader);
  });
