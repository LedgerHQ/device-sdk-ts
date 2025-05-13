import { ContainerModule } from "inversify";

import { DefaultCommandDecoderDataSource } from "@/uniswap/data/DefaultCommandDecoderDataSource";
import { EthersAbiDecoderDataSource } from "@/uniswap/data/EthersAbiDecoderDataSource";
import { UniswapContextLoader } from "@/uniswap/domain/UniswapContextLoader";

import { uniswapTypes } from "./uniswapTypes";

export const uniswapModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(uniswapTypes.AbiDecoderDataSource).to(EthersAbiDecoderDataSource);
    bind(uniswapTypes.CommandDecoderDataSource).to(
      DefaultCommandDecoderDataSource,
    );
    bind(uniswapTypes.UniswapContextLoader).to(UniswapContextLoader);
  });
