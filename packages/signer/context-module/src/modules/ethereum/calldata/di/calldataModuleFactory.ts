import { ContainerModule } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/chain-agnostic/pki/di/pkiTypes";
import { HttpCalldataDescriptorDataSource } from "@/modules/ethereum/calldata/data/HttpCalldataDescriptorDataSource";
import { calldataTypes } from "@/modules/ethereum/calldata/di/calldataTypes";
import { CalldataContextLoader } from "@/modules/ethereum/calldata/domain/CalldataContextLoader";
import { networkTypes } from "@/shared/network/di/networkTypes";

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
