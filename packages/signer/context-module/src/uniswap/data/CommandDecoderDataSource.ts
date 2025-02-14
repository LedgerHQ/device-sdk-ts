import { type HexaString } from "@ledgerhq/device-management-kit";

import { type UniswapSupportedCommand } from "@/uniswap/constants/uniswap";

export interface CommandDecoderDataSource {
  decode(
    command: UniswapSupportedCommand,
    input: HexaString,
    chainId: number,
  ): HexaString[];
}
