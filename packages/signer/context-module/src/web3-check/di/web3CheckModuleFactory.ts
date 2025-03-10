import { ContainerModule } from "inversify";

import { HttpWeb3CheckDataSource } from "@/web3-check/data/HttpWeb3CheckDataSource";
import { DefaultWeb3CheckContextLoader } from "@/web3-check/domain/DefaultWeb3CheckLoader";

import { web3CheckTypes } from "./web3CheckTypes";

export const web3CheckModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(web3CheckTypes.Web3CheckDataSource).to(HttpWeb3CheckDataSource);
    bind(web3CheckTypes.Web3CheckContextLoader).to(
      DefaultWeb3CheckContextLoader,
    );
  });
