import { ContainerModule } from "inversify";

import { HttpWeb3CheckDataSource } from "@/shared-loaders/web3-checks/data/HttpWeb3CheckDataSource";
import { web3ChecksTypes } from "@/shared-loaders/web3-checks/di/web3ChecksTypes";
import { ethereumTransactionWeb3CheckTypes } from "@/shared-loaders/web3-checks/ethereum/di/ethereumWeb3CheckTypes";
import { EthereumTransactionWeb3CheckContextLoader } from "@/shared-loaders/web3-checks/ethereum/domain/EthereumTransactionWeb3CheckContextLoader";
import { EthereumTypedDataWeb3CheckContextLoader } from "@/shared-loaders/web3-checks/ethereum/domain/EthereumTypedDataWeb3CheckContextLoader";

export const ethereumTransactionWeb3CheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(web3ChecksTypes.Web3CheckDataSource).to(HttpWeb3CheckDataSource);
    bind(
      ethereumTransactionWeb3CheckTypes.EthereumTransactionWeb3CheckContextLoader,
    ).to(EthereumTransactionWeb3CheckContextLoader);
    bind(
      ethereumTransactionWeb3CheckTypes.EthereumTypedDataWeb3CheckContextLoader,
    ).to(EthereumTypedDataWeb3CheckContextLoader);
  });
