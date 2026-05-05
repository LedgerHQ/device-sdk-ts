import { ContainerModule } from "inversify";

import { DefaultCommandDecoderDataSource } from "@/loaders/ethereum/uniswap/data/DefaultCommandDecoderDataSource";
import { EthersAbiDecoderDataSource } from "@/loaders/ethereum/uniswap/data/EthersAbiDecoderDataSource";
import { UniswapContextLoader } from "@/loaders/ethereum/uniswap/domain/UniswapContextLoader";

import { ethereumUniswapTypes } from "./ethereumUniswapTypes";

export const uniswapModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumUniswapTypes.EthereumAbiDecoderDataSource).to(
      EthersAbiDecoderDataSource,
    );
    bind(ethereumUniswapTypes.EthereumCommandDecoderDataSource).to(
      DefaultCommandDecoderDataSource,
    );
    bind(ethereumUniswapTypes.EthereumUniswapContextLoader).to(
      UniswapContextLoader,
    );
  });
