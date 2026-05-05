import { ContainerModule } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { networkTypes } from "@/loaders/chain-agnostic/network/di/networkTypes";
import { pkiTypes } from "@/loaders/chain-agnostic/pki/di/pkiTypes";
import { HttpCalldataDescriptorDataSource } from "@/loaders/ethereum/calldata/data/HttpCalldataDescriptorDataSource";
import { ethereumCalldataTypes } from "@/loaders/ethereum/calldata/di/ethereumCalldataTypes";
import { CalldataContextLoader } from "@/loaders/ethereum/calldata/domain/CalldataContextLoader";

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
