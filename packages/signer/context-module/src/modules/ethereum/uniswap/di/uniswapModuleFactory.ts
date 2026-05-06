import { ContainerModule } from "inversify";

import { DefaultCommandDecoderDataSource } from "@/modules/ethereum/uniswap/data/DefaultCommandDecoderDataSource";
import { EthersAbiDecoderDataSource } from "@/modules/ethereum/uniswap/data/EthersAbiDecoderDataSource";
import { UniswapContextLoader } from "@/modules/ethereum/uniswap/domain/UniswapContextLoader";

import { uniswapTypes } from "./uniswapTypes";

export const uniswapModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(uniswapTypes.AbiDecoderDataSource).to(EthersAbiDecoderDataSource);
    bind(uniswapTypes.CommandDecoderDataSource).to(
      DefaultCommandDecoderDataSource,
    );
    bind(uniswapTypes.UniswapContextLoader).to(UniswapContextLoader);
  });
