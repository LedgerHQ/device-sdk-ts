import { ContainerModule } from "inversify";

import { DefaultCommandDecoderDataSource } from "@/ethereum-loaders/uniswap/data/DefaultCommandDecoderDataSource";
import { EthersAbiDecoderDataSource } from "@/ethereum-loaders/uniswap/data/EthersAbiDecoderDataSource";
import { UniswapContextLoader } from "@/ethereum-loaders/uniswap/domain/UniswapContextLoader";

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
