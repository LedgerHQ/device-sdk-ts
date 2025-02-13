import { type HexaString, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { UniswapSupportedCommand } from "@/uniswap/constants/uniswap";
import {
  WETH_ADDRESS_BY_CHAIN_ID,
  WETHSupportedChainId,
  WETHSupportedChainIds,
} from "@/uniswap/constants/weth";
import { uniswapTypes } from "@/uniswap/di/uniswapTypes";

import { type AbiDecoderDataSource } from "./AbiDecoderDataSource";

const ADDRESS_LENGTH = 20 * 2;
const FEE_LENGTH = 3 * 2;

@injectable()
export class DefaultCommandDecoderDataSource {
  constructor(
    @inject(uniswapTypes.AbiDecoderDataSource)
    private abiDecoder: AbiDecoderDataSource,
  ) {}

  decode(
    command: UniswapSupportedCommand,
    input: HexaString,
    chainId: number,
  ): HexaString[] {
    switch (command) {
      case UniswapSupportedCommand.V2_SWAP_EXACT_IN:
        return this._decodeSwapV2(input);
      case UniswapSupportedCommand.V2_SWAP_EXACT_OUT:
        return this._decodeSwapV2(input);
      case UniswapSupportedCommand.V3_SWAP_EXACT_IN:
        return this._decodeSwapV3(input);
      case UniswapSupportedCommand.V3_SWAP_EXACT_OUT:
        return this._decodeSwapV3(input);
      case UniswapSupportedCommand.WRAP_ETH:
        return this._decodeWrappedEth(input, chainId);
      case UniswapSupportedCommand.UNWRAP_ETH:
        return this._decodeWrappedEth(input, chainId);
      case UniswapSupportedCommand.SWEEP:
        return this._decodeSweep(input);
      case UniswapSupportedCommand.PERMIT2_PERMIT:
      case UniswapSupportedCommand.PERMIT2_TRANSFER_FROM:
      case UniswapSupportedCommand.PERMIT2_PERMIT_BATCH:
      case UniswapSupportedCommand.PERMIT2_TRANSFER_FROM_BATCH:
      case UniswapSupportedCommand.PAY_PORTION:
        return [];
      default:
        return [];
    }
  }

  private _decodeSwapV2(input: HexaString): HexaString[] {
    const [, , , addresses] = this.abiDecoder.decode(
      ["address", "uint256", "uint256", "address[]", "bool"],
      input,
    );

    if (!Array.isArray(addresses) || !addresses.every(isHexaString)) {
      return [];
    }

    return addresses.map(
      (address: HexaString) => address.toLowerCase() as HexaString,
    );
  }

  private _decodeSwapV3(input: HexaString): HexaString[] {
    const [, , , path] = this.abiDecoder.decode(
      ["address", "uint256", "uint256", "bytes", "bool"],
      input,
    );
    // Path is at least 43 bytes long for 2 times 20B addresses + 3B fee in between
    // Example: 0x -> 20B address -> 3B fee -> 20B address -> 3B fee -> 20B address
    if (
      typeof path !== "string" ||
      !isHexaString(path) ||
      path.length < 2 + ADDRESS_LENGTH * 2 + FEE_LENGTH
    ) {
      return [];
    }

    // Get all the addresses, skip the 0x prefix
    const tokens: string[] = [];
    for (let i = 2; i < path.length; i += ADDRESS_LENGTH + FEE_LENGTH) {
      tokens.push(path.slice(i, i + ADDRESS_LENGTH));
    }

    return tokens
      .map((token) => token.toLowerCase())
      .map((token) => `0x${token}` as HexaString);
  }

  private _isSupportedChainId(
    chainId: number,
  ): chainId is WETHSupportedChainId {
    return Object.values(WETHSupportedChainIds).includes(chainId);
  }

  private _decodeWrappedEth(_input: HexaString, chainId: number): HexaString[] {
    if (!this._isSupportedChainId(chainId)) {
      return [];
    }

    return [WETH_ADDRESS_BY_CHAIN_ID[chainId].toLowerCase() as HexaString];
  }

  private _decodeSweep = (input: HexaString): HexaString[] => {
    const [token] = this.abiDecoder.decode(
      ["address", "address", "uint256"],
      input,
    );

    if (typeof token !== "string" || !isHexaString(token)) {
      return [];
    }

    return [token.toLowerCase() as HexaString];
  };
}
