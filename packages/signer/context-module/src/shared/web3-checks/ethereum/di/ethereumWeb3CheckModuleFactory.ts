import { ContainerModule } from "inversify";

import { HttpWeb3CheckDataSource } from "@/shared/web3-checks/data/HttpWeb3CheckDataSource";
import { web3ChecksTypes } from "@/shared/web3-checks/di/web3ChecksTypes";
import { ethereumWeb3CheckTypes } from "@/shared/web3-checks/ethereum/di/ethereumWeb3CheckTypes";
import { EthereumTypedDataCheckContextLoader } from "@/shared/web3-checks/ethereum/domain/EthereumTypedDataCheckContextLoader";
import { EthereumWeb3CheckContextLoader } from "@/shared/web3-checks/ethereum/domain/EthereumWeb3CheckContextLoader";

export const ethereumWeb3CheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(web3ChecksTypes.Web3CheckDataSource).to(HttpWeb3CheckDataSource);
    bind(ethereumWeb3CheckTypes.EthereumWeb3CheckContextLoader).to(
      EthereumWeb3CheckContextLoader,
    );
    bind(ethereumWeb3CheckTypes.EthereumTypedDataCheckContextLoader).to(
      EthereumTypedDataCheckContextLoader,
    );
  });
