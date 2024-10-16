import type { HexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import type {
  TypedDataClearSignContext,
  TypedDataFilter,
  TypedDataFilterPath,
  TypedDataToken,
  TypedDataTokenIndex,
} from "@/shared/model/TypedDataClearSignContext";
import { VERIFYING_CONTRACT_TOKEN_INDEX } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";
import type { TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import { typedDataTypes } from "@/typed-data/di/typedDataTypes";
import type { TypedDataContextLoader } from "@/typed-data/domain/TypedDataContextLoader";

@injectable()
export class DefaultTypedDataContextLoader implements TypedDataContextLoader {
  constructor(
    @inject(typedDataTypes.TypedDataDataSource)
    private dataSource: TypedDataDataSource,
    @inject(tokenTypes.TokenDataSource)
    private tokenDataSource: TokenDataSource,
  ) {}

  async load(typedData: TypedDataContext): Promise<TypedDataClearSignContext> {
    // Get the typed data filters from the data source
    const data = await this.dataSource.getTypedDataFilters({
      address: typedData.verifyingContract,
      chainId: typedData.chainId,
      version: typedData.version,
      schema: typedData.schema,
    });

    // If there was an error getting the typed data filters, return an error immediately
    if (data.isLeft()) {
      return {
        type: "error",
        error: data.extract(),
      };
    }

    // Else, extract the message info and filters
    const { messageInfo, filters } = data.unsafeCoerce();

    // Loop through the typed data filters to extract informations
    const mappedFilters: Record<TypedDataFilterPath, TypedDataFilter> = {};
    const mappedTokens: Record<TypedDataTokenIndex, TypedDataToken> = {};
    for (const filter of filters) {
      // Add the filter to the clear signing context
      mappedFilters[filter.path] = filter;
      if (filter.type !== "token" && filter.type !== "amount") {
        continue; // no token reference
      }

      // If the filter references a token, retrieve its descriptor from the tokens data source
      const tokenIndex = filter.tokenIndex;
      if (mappedTokens[tokenIndex] !== undefined) {
        continue; // Already fetched for a previous filter
      }

      // If the filter is a token, get token address from typed message values, and fetch descriptor
      if (filter.type === "token") {
        const value = typedData.fieldsValues.find(
          (entry) => entry.path === filter.path,
        );
        if (value === undefined) {
          return {
            type: "error",
            error: new Error(
              `The token filter references the value ${filter.path} which is absent from the message`,
            ),
          };
        }
        // Fetch descriptor
        const address = this.convertAddressToHexaString(value.value);
        const chainId = typedData.chainId;
        const payload = await this.tokenDataSource.getTokenInfosPayload({
          address,
          chainId,
        });
        payload.ifRight((payload) => {
          mappedTokens[tokenIndex] = payload;
        });
      }

      // If the filter is an amount with a reference to the verifyingContract, fetch verifyingContract descriptor.
      // This is because descriptors data-sources should be compatible with Ledger devices specifications:
      // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#amount-join-value
      else if (
        filter.type === "amount" &&
        tokenIndex === VERIFYING_CONTRACT_TOKEN_INDEX
      ) {
        const address = typedData.verifyingContract;
        const chainId = typedData.chainId;
        const payload = await this.tokenDataSource.getTokenInfosPayload({
          address,
          chainId,
        });
        payload.ifRight((payload) => {
          mappedTokens[tokenIndex] = payload;
        });
      }
    }

    return {
      type: "success",
      messageInfo,
      filters: mappedFilters,
      tokens: mappedTokens,
    };
  }

  private convertAddressToHexaString(address: Uint8Array): HexaString {
    // Address size is 20 bytes so 40 characters, padded with zeros on the left
    return `0x${Array.from(address, (byte) =>
      byte.toString(16).padStart(2, "0"),
    )
      .join("")
      .padStart(40, "0")}`;
  }
}
