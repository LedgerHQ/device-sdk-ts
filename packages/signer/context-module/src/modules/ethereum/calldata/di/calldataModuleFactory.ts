import { ContainerModule } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/chain-agnostic/pki/di/pkiTypes";
import { HttpCalldataDescriptorDataSource } from "@/modules/ethereum/calldata/data/HttpCalldataDescriptorDataSource";
import { ethereumCalldataTypes } from "@/modules/ethereum/calldata/di/ethereumCalldataTypes";
import { CalldataContextLoader } from "@/modules/ethereum/calldata/domain/CalldataContextLoader";
import { networkTypes } from "@/shared/network/di/networkTypes";

export const calldataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(
      ethereumCalldataTypes.EthereumDappCalldataDescriptorDataSource,
    ).toDynamicValue(
      (context) =>
        new HttpCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          "dapps",
          context.get(networkTypes.NetworkClient),
        ),
    );
    bind(
      ethereumCalldataTypes.EthereumTokenCalldataDescriptorDataSource,
    ).toDynamicValue(
      (context) =>
        new HttpCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          "tokens",
          context.get(networkTypes.NetworkClient),
        ),
    );
    bind(ethereumCalldataTypes.EthereumCalldataContextLoader).to(
      CalldataContextLoader,
    );
  });
