import { ContainerModule } from "inversify";

import { networkTypes } from "@/chain-agnostic-loaders/network/di/networkTypes";
import { pkiTypes } from "@/chain-agnostic-loaders/pki/di/pkiTypes";
import { configTypes } from "@/config/di/configTypes";
import { HttpCalldataDescriptorDataSource } from "@/ethereum-loaders/calldata/data/HttpCalldataDescriptorDataSource";
import { ethereumCalldataTypes } from "@/ethereum-loaders/calldata/di/ethereumCalldataTypes";
import { CalldataContextLoader } from "@/ethereum-loaders/calldata/domain/CalldataContextLoader";

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
