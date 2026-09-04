import { type HexaString } from "@ledgerhq/device-management-kit";

export const UNISWAP_EXECUTE_ABI = [
  "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
];

export const UNISWAP_EXECUTE_SELECTOR = "0x3593564c";

export enum UniswapSupportedCommand {
  V2_SWAP_EXACT_IN = "V2_SWAP_EXACT_IN",
  V2_SWAP_EXACT_OUT = "V2_SWAP_EXACT_OUT",
  V3_SWAP_EXACT_IN = "V3_SWAP_EXACT_IN",
  V3_SWAP_EXACT_OUT = "V3_SWAP_EXACT_OUT",
  V4_SWAP = "V4_SWAP",
  WRAP_ETH = "WRAP_ETH",
  UNWRAP_ETH = "UNWRAP_ETH",
  PERMIT2_PERMIT = "PERMIT2_PERMIT",
  PERMIT2_TRANSFER_FROM = "PERMIT2_TRANSFER_FROM",
  PERMIT2_PERMIT_BATCH = "PERMIT2_PERMIT_BATCH",
  PERMIT2_TRANSFER_FROM_BATCH = "PERMIT2_TRANSFER_FROM_BATCH",
  PAY_PORTION = "PAY_PORTION",
  SWEEP = "SWEEP",
}

// Command bytes follow the Universal Router's Commands.sol dispatch table.
export const UNISWAP_COMMANDS: Record<HexaString, UniswapSupportedCommand> = {
  "0x08": UniswapSupportedCommand.V2_SWAP_EXACT_IN,
  "0x09": UniswapSupportedCommand.V2_SWAP_EXACT_OUT,
  "0x00": UniswapSupportedCommand.V3_SWAP_EXACT_IN,
  "0x01": UniswapSupportedCommand.V3_SWAP_EXACT_OUT,
  "0x10": UniswapSupportedCommand.V4_SWAP,
  "0x0b": UniswapSupportedCommand.WRAP_ETH,
  "0x0c": UniswapSupportedCommand.UNWRAP_ETH,
  "0x0a": UniswapSupportedCommand.PERMIT2_PERMIT,
  "0x02": UniswapSupportedCommand.PERMIT2_TRANSFER_FROM,
  "0x03": UniswapSupportedCommand.PERMIT2_PERMIT_BATCH,
  "0x0d": UniswapSupportedCommand.PERMIT2_TRANSFER_FROM_BATCH,
  "0x06": UniswapSupportedCommand.PAY_PORTION,
  "0x04": UniswapSupportedCommand.SWEEP,
};

export const UNISWAP_SWAP_COMMANDS: UniswapSupportedCommand[] = [
  UniswapSupportedCommand.V2_SWAP_EXACT_IN,
  UniswapSupportedCommand.V2_SWAP_EXACT_OUT,
  UniswapSupportedCommand.V3_SWAP_EXACT_IN,
  UniswapSupportedCommand.V3_SWAP_EXACT_OUT,
  UniswapSupportedCommand.V4_SWAP,
];

// V4_SWAP nests its own action program: abi.encode(bytes actions, bytes[] params).
// Path-form swap actions carry the route currencies; SETTLE / TAKE currencies are
// always covered by the swap path itself.
export const UNISWAP_V4_ACTIONS = {
  SWAP_EXACT_IN: 0x07,
  SWAP_EXACT_OUT: 0x09,
} as const;
