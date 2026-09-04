import { type HexaString, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import {
  UNISWAP_V4_ACTIONS,
  UniswapSupportedCommand,
} from "@/modules/ethereum/uniswap/constants/uniswap";
import {
  WETH_ADDRESS_BY_CHAIN_ID,
  WETHSupportedChainId,
  WETHSupportedChainIds,
} from "@/modules/ethereum/uniswap/constants/weth";
import { uniswapTypes } from "@/modules/ethereum/uniswap/di/uniswapTypes";

import { type AbiDecoderDataSource } from "./AbiDecoderDataSource";

const ADDRESS_LENGTH = 20 * 2;
const FEE_LENGTH = 3 * 2;

// V4 pools quote the native currency as address zero: no ERC-20 descriptor exists.
const NATIVE_CURRENCY = "0x0000000000000000000000000000000000000000";

const V4_PATHKEY =
  "tuple(address intermediateCurrency, uint24 fee, int24 tickSpacing, address hooks, bytes hookData)";
// Universal Router 2.0 swap params, and the 2.1.1 layout which inserts a
// minHopPriceX36 array between the path and the amounts.
const V4_SWAP_PARAMS_LAYOUTS = [
  `tuple(address currency, ${V4_PATHKEY}[] path, uint128 amountSpecified, uint128 amountLimit)`,
  `tuple(address currency, ${V4_PATHKEY}[] path, uint256[] minHopPriceX36, uint128 amountSpecified, uint128 amountLimit)`,
];

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
      case UniswapSupportedCommand.V4_SWAP:
        return this._decodeSwapV4(input);
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

  /**
   * Decodes a V4_SWAP command input: abi.encode(bytes actions, bytes[] params),
   * a nested action program. The route currencies live in the path-form swap
   * actions (SWAP_EXACT_IN / SWAP_EXACT_OUT): the leading currency plus each
   * PathKey's intermediateCurrency. SETTLE / TAKE actions only move currencies
   * already named by a swap path, so they contribute no extra addresses.
   * The native currency (address zero) has no ERC-20 descriptor and is skipped.
   */
  private _decodeSwapV4(input: HexaString): HexaString[] {
    const [actions, params] = this.abiDecoder.decode(
      ["bytes", "bytes[]"],
      input,
    );

    if (!isHexaString(actions) || !Array.isArray(params)) {
      return [];
    }

    const actionBytes = actions.slice(2).match(/../g) ?? [];
    const tokens: HexaString[] = [];
    for (const [index, action] of actionBytes.entries()) {
      const opcode = parseInt(action, 16);
      if (
        opcode !== UNISWAP_V4_ACTIONS.SWAP_EXACT_IN &&
        opcode !== UNISWAP_V4_ACTIONS.SWAP_EXACT_OUT
      ) {
        continue;
      }
      const param: unknown = params[index];
      if (!isHexaString(param)) {
        return [];
      }
      tokens.push(...this._decodeV4SwapCurrencies(param));
    }

    return tokens;
  }

  private _decodeV4SwapCurrencies(param: HexaString): HexaString[] {
    for (const layout of V4_SWAP_PARAMS_LAYOUTS) {
      const [decoded] = this.abiDecoder.decode([layout], param);
      if (!Array.isArray(decoded)) {
        continue;
      }
      const [currency, path] = decoded as unknown[];
      if (!isHexaString(currency) || !Array.isArray(path)) {
        continue;
      }
      const currencies = [
        currency,
        ...path.map((pathKey: unknown) =>
          Array.isArray(pathKey) ? (pathKey as unknown[])[0] : undefined,
        ),
      ];
      if (!currencies.every(isHexaString)) {
        continue;
      }
      return currencies
        .map((address) => address.toLowerCase() as HexaString)
        .filter((address) => address !== NATIVE_CURRENCY);
    }
    return [];
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
