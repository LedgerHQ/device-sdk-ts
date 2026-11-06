import {
  HexaString,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Interface } from "ethers";
import { inject, injectable } from "inversify";
import { Maybe, Nothing } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type TokenDataSource } from "@/modules/ethereum/token/data/TokenDataSource";
import { tokenTypes } from "@/modules/ethereum/token/di/tokenTypes";
import {
  UNISWAP_COMMANDS,
  UNISWAP_EXECUTE_ABI,
  UNISWAP_EXECUTE_SELECTOR,
  UniswapSupportedCommand,
} from "@/modules/ethereum/uniswap/constants/uniswap";
import { type CommandDecoderDataSource } from "@/modules/ethereum/uniswap/data/CommandDecoderDataSource";
import { uniswapTypes } from "@/modules/ethereum/uniswap/di/uniswapTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type UniswapContextInput = {
  data: HexaString;
  selector: HexaString;
  chainId: number;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_TOKEN,
];

@injectable()
export class UniswapContextLoader
  implements ContextLoader<UniswapContextInput>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(uniswapTypes.CommandDecoderDataSource)
    private commandDecoderDataSource: CommandDecoderDataSource,
    @inject(tokenTypes.TokenDataSource)
    private tokenDataSource: TokenDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("UniswapContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is UniswapContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "data" in input &&
      "selector" in input &&
      "chainId" in input &&
      typeof input.chainId === "number" &&
      isHexaString(input.data) &&
      input.data !== "0x" &&
      isHexaString(input.selector) &&
      input.selector === UNISWAP_EXECUTE_SELECTOR &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: UniswapContextInput): Promise<ClearSignContext[]> {
    const { data, chainId } = input;
    const result = await this._extractClearSignContexts(data, chainId);
    this.logger.debug("load result", { data: { result } });
    return result;
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

      // No route-shape filtering here: the plugin enforces display integrity
      // on-device and now supports chained, split and mixed-version routes
      // (including V4). This loader only provides token descriptors.
      const uniqueAddresses = [
        ...new Set(addressesByCommand.flatMap(([, addresses]) => addresses)),
      ];

      const tokensPayload = await Promise.all(
        uniqueAddresses.map((address) =>
          this.tokenDataSource.getTokenInfosPayload({ address, chainId }),
        ),
      );

      const contexts = tokensPayload.map((either) =>
        either.caseOf<ClearSignContext>({
          Left: (error) => ({ type: ClearSignContextType.ERROR, error }),
          Right: (payload) => ({
            type: ClearSignContextType.ETHEREUM_TOKEN,
            payload,
          }),
        }),
      );

      return contexts;
    } catch (_error) {
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
