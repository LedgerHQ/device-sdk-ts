import { ContainerModule } from "inversify";

import { DefaultCommandDecoderDataSource } from "@/modules/ethereum/uniswap/data/DefaultCommandDecoderDataSource";
import { EthersAbiDecoderDataSource } from "@/modules/ethereum/uniswap/data/EthersAbiDecoderDataSource";
import { UniswapContextLoader } from "@/modules/ethereum/uniswap/domain/UniswapContextLoader";

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
