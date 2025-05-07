import {
  bufferToHexaString,
  ByteArrayBuilder,
  HexaString,
  hexaStringToBuffer,
  isHexaString,
} from "@ledgerhq/device-management-kit";
import { Interface } from "ethers";
import { inject, injectable } from "inversify";
import { Maybe, Nothing } from "purify-ts";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";
import {
  UNISWAP_PLUGIN_NAME,
  UNISWAP_PLUGIN_SIGNATURE,
} from "@/uniswap/constants/plugin";
import {
  UNISWAP_COMMANDS,
  UNISWAP_EXECUTE_ABI,
  UNISWAP_EXECUTE_SELECTOR,
  UNISWAP_SWAP_COMMANDS,
  UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
  UniswapSupportedCommand,
} from "@/uniswap/constants/uniswap";
import { type CommandDecoderDataSource } from "@/uniswap/data/CommandDecoderDataSource";
import { uniswapTypes } from "@/uniswap/di/uniswapTypes";

@injectable()
export class UniswapContextLoader implements ContextLoader {
  constructor(
    @inject(uniswapTypes.CommandDecoderDataSource)
    private commandDecoderDataSource: CommandDecoderDataSource,
    @inject(tokenTypes.TokenDataSource)
    private tokenDataSource: TokenDataSource,
  ) {}

  async load(transaction: TransactionContext): Promise<ClearSignContext[]> {
    if (!transaction.data || !isHexaString(transaction.data)) {
      return [];
    }

    const selector = transaction.data.slice(0, 10);
    if (selector !== UNISWAP_EXECUTE_SELECTOR) {
      return [];
    }

    const externalPluginContext = this._buildUniswapPluginCommandData();
    const tokenContexts = await this._extractClearSignContexts(
      transaction.data,
      transaction.chainId,
    );

    if (tokenContexts.length > 0)
      return [externalPluginContext, ...tokenContexts];

    return [];
  }

  /**
   * Constructs the external plugin context for Uniswap external plugin command.
   *
   * @private
   * @returns {ClearSignContext} - The generated external plugin context.
   */
  private _buildUniswapPluginCommandData(): ClearSignContext {
    const buffer = new ByteArrayBuilder()
      .add8BitUIntToData(UNISWAP_PLUGIN_NAME.length)
      .addAsciiStringToData(UNISWAP_PLUGIN_NAME)
      .addBufferToData(hexaStringToBuffer(UNISWAP_UNIVERSAL_ROUTER_ADDRESS)!)
      .addBufferToData(hexaStringToBuffer(UNISWAP_EXECUTE_SELECTOR)!)
      .addBufferToData(hexaStringToBuffer(UNISWAP_PLUGIN_SIGNATURE)!)
      .build();

    return {
      type: ClearSignContextType.EXTERNAL_PLUGIN,
      payload: bufferToHexaString(buffer).slice(2),
    };
  }

  /**
   * Extracts and decodes the clear sign contexts from a Uniswap calldata transaction.
   *
   * This function:
   * - Parses the calldata using the Uniswap `execute` function signature.
   * - Extracts and validates the `commands` and `inputs`.
   * - Decodes the commands and ensures they match the number of inputs.
   * - Extracts addresses used in the transaction and verifies if chaining swaps are supported.
   * - Fetches token information for unique addresses.
   * - Returns an array of `ClearSignContext` objects representing either token data or errors.
   *
   * @private
   * @param {HexaString} calldata - The raw calldata of the Uniswap transaction.
   * @param {number} chainId - The blockchain chain ID where the transaction is being executed.
   * @returns {Promise<ClearSignContext[]>} - A promise resolving to an array of clear sign contexts.
   */
  private async _extractClearSignContexts(
    calldata: HexaString,
    chainId: number,
  ): Promise<ClearSignContext[]> {
    try {
      const iface = new Interface(UNISWAP_EXECUTE_ABI);

      const tx = iface.parseTransaction({ data: calldata });
      const commands: unknown = tx?.args[0];
      const inputs: unknown = tx?.args[1];

      if (!isHexaString(commands) || !this._isHexaStringArray(inputs)) {
        return [];
      }

      const decodedCommands = this._extractCommands(commands).orDefault([]);
      if (commands.length === 0 || inputs.length !== decodedCommands.length) {
        // Invalid commands or inputs
        return [];
      }

      const addressesByCommand = decodedCommands.reduce(
        (acc, command, index) => {
          const input = inputs[index]!;
          const decoded: HexaString[] = this.commandDecoderDataSource.decode(
            command,
            input,
            chainId,
          );

          acc.push([command, decoded]);

          return acc;
        },
        [] as [UniswapSupportedCommand, HexaString[]][],
      );

      if (!this._isChainingSwapSupported(addressesByCommand)) {
        return [];
      }

      const uniqueAddresses = [
        ...new Set(addressesByCommand.flatMap(([, addresses]) => addresses)),
      ];

      const tokensPayload = await Promise.all(
        uniqueAddresses.map((address) =>
          this.tokenDataSource.getTokenInfosPayload({ address, chainId }),
        ),
      );

      return tokensPayload.map((either) =>
        either.caseOf<ClearSignContext>({
          Left: (error) => ({ type: ClearSignContextType.ERROR, error }),
          Right: (payload) => ({ type: ClearSignContextType.TOKEN, payload }),
        }),
      );
    } catch (_) {
      return [];
    }
  }

  /**
   * Extracts Uniswap-supported commands from a hexadecimal string.
   * Each command is represented by one byte (2 hex characters), and this function:
   * - Maps each command to a known Uniswap command.
   * - Returns `Nothing` if any extracted command is unsupported.
   *
   * @private
   * @param {HexaString} hex - A hexadecimal string representing commands.
   * @returns {Maybe<UniswapSupportedCommand[]>} - A `Maybe` containing an array of recognized commands, or `Nothing` if any command is unsupported.
   *
   * @example
   * // Valid command extraction
   * _extractCommands('0x0008');
   * // Returns: Just(['0x00', '0x08'])
   *
   * @example
   * // Contains an unsupported command (0x05 is not supported)
   * _extractCommands('0x0005');
   * // Returns: Nothing
   *
   * @example
   * // Empty or invalid input
   * _extractCommands('0x');
   * // Returns: Nothing
   */
  private _extractCommands(hex: HexaString): Maybe<UniswapSupportedCommand[]> {
    return Maybe.fromNullable(hex.slice(2).match(/../g))
      .map((bytes) => bytes.map((b) => `0x${b}` as HexaString))
      .map((hexBytes) => hexBytes.map((b) => UNISWAP_COMMANDS[b]))
      .chain((commands) =>
        commands.every((command) => command !== undefined)
          ? Maybe.of(commands as UniswapSupportedCommand[])
          : Nothing,
      );
  }

  /**
   * Checks if the provided swap commands can be chained together.
   * A valid chain requires that:
   * - The output asset of the previous swap matches the input asset of the next swap.
   * - The pool version remains consistent across swaps.
   *
   * @private
   * @param {Array<[UniswapSupportedCommand, HexaString[]]>} data - An array of tuples containing a swap command and associated addresses.
   * @returns {boolean} - Returns `true` if the swap commands form a valid chain, otherwise `false`.
   *
   * @example
   * // Valid chaining: same output/input asset and pool version
   * _isChainingSwapSupported([
   *   ['0x08', ['0xABC', '0xDEF']],
   *   ['0x08', ['0xDEF', '0x123']]
   * ]);
   * // Returns: true
   *
   * @example
   * // Invalid chaining: different pool versions
   * _isChainingSwapSupported([
   *   ['0x08', ['0xABC', '0xDEF']],
   *   ['0x01', ['0xDEF', '0x123']]
   * ]);
   * // Returns: false
   *
   * @example
   * // Invalid chaining: output does not match next input
   * _isChainingSwapSupported([
   *   ['0x01A1', ['0xABC', '0xDEF']],
   *   ['0x01B2', ['0xXYZ', '0x123']]
   * ]);
   * // Returns: false
   */
  private _isChainingSwapSupported(
    data: [UniswapSupportedCommand, HexaString[]][],
  ): boolean {
    let lastAsset: HexaString | undefined = undefined;
    let lastPoolVersion: string | undefined = undefined;

    for (const [command, addresses] of data) {
      if (!UNISWAP_SWAP_COMMANDS.includes(command)) continue; // Ignore non-swap commands

      const poolVersion = command.slice(0, 2);

      if (
        lastAsset &&
        (lastAsset !== addresses[0] || lastPoolVersion !== poolVersion)
      ) {
        // Invalid chaining, return empty array
        return false;
      }

      // update last asset and pool version
      lastAsset = addresses[addresses.length - 1];
      lastPoolVersion = poolVersion;
    }

    return true;
  }

  /**
   * Checks if a given value is an array of hexadecimal strings.
   *
   * @private
   * @param {unknown} array - The value to check.
   * @returns {array is HexaString[]} - `true` if the value is an array of hexadecimal strings, otherwise `false`.
   */
  private _isHexaStringArray(array: unknown): array is HexaString[] {
    return (
      Array.isArray(array) &&
      array.every((item) => typeof item === "string" && isHexaString(item))
    );
  }
}
