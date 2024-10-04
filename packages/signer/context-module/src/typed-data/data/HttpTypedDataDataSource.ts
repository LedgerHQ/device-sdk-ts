import axios from "axios";
import SHA224 from "crypto-js/sha224";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import type {
  TypedDataFilter,
  TypedDataMessageInfo,
} from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataSchema } from "@/shared/model/TypedDataContext";
import PACKAGE from "@root/package.json";

import type {
  FilterField,
  FilterFieldV1,
  FilterFieldV2,
  FilterFieldV2WithCoinRef,
  FiltersDto,
} from "./FiltersDto";
import {
  GetTypedDataFiltersParams,
  GetTypedDataFiltersResult,
  TypedDataDataSource,
} from "./TypedDataDataSource";

@injectable()
export class HttpTypedDataDataSource implements TypedDataDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  public async getTypedDataFilters({
    chainId,
    address,
    schema,
    version,
  }: GetTypedDataFiltersParams): Promise<
    Either<Error, GetTypedDataFiltersResult>
  > {
    try {
      const response = await axios.request<FiltersDto[]>({
        method: "GET",
        url: `${this.config.cal.url}/dapps`,
        params: {
          contracts: address,
          chain_id: chainId,
          output: "eip712_signatures",
          eip712_signatures_version: version,
        },
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      // Try to get the filters JSON descriptor, from address and schema hash
      const schemaHash = SHA224(
        JSON.stringify(this.sortTypes(schema)).replace(" ", ""),
      ).toString();
      const filtersJson =
        response.data?.[0]?.eip712_signatures?.[address]?.[schemaHash];
      if (!filtersJson) {
        return Left(
          new Error(
            `[ContextModule] HttpTypedDataDataSource: no typed data filters for address ${address} on chain ${chainId} for schema ${schemaHash}`,
          ),
        );
      }

      // Parse the message type, if available
      if (
        !filtersJson.contractName ||
        typeof filtersJson.contractName.label !== "string" ||
        typeof filtersJson.contractName.signature !== "string" ||
        !Array.isArray(filtersJson.fields)
      ) {
        return Left(
          new Error(
            `[ContextModule] HttpTypedDataDataSource: no message info for address ${address} on chain ${chainId} for schema ${schemaHash}`,
          ),
        );
      }
      const messageInfo: TypedDataMessageInfo = {
        displayName: filtersJson.contractName.label,
        filtersCount: filtersJson.fields.length,
        signature: filtersJson.contractName.signature,
      };

      // Parse all the filters
      const filters: TypedDataFilter[] = [];
      for (const field of filtersJson.fields) {
        if (this.isFieldFilterV1(field)) {
          filters.push({
            type: "raw",
            displayName: field.label,
            path: field.path,
            signature: field.signature,
          });
        } else if (this.isFieldFilterV2(field)) {
          filters.push({
            type: field.format,
            displayName: field.label,
            path: field.path,
            signature: field.signature,
          });
        } else if (this.isFieldFilterV2WithCoinRef(field)) {
          filters.push({
            type: field.format,
            displayName: field.label,
            path: field.path,
            signature: field.signature,
            tokenIndex: field.coin_ref,
          });
        } else {
          return Left(
            new Error(
              `[ContextModule] HttpTypedDataDataSource: invalid typed data field for address ${address} on chain ${chainId} for schema ${schemaHash}`,
            ),
          );
        }
      }

      return Right({ messageInfo, filters });
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTypedDataDataSource: Failed to fetch typed data informations",
        ),
      );
    }
  }

  private isFieldFilterV1(data: FilterField): data is FilterFieldV1 {
    return (
      typeof data === "object" &&
      typeof data.label === "string" &&
      typeof data.path === "string" &&
      typeof data.signature === "string" &&
      (data.format === undefined || data.format === null)
    );
  }

  private isFieldFilterV2(data: FilterField): data is FilterFieldV2 {
    return (
      typeof data === "object" &&
      typeof data.label === "string" &&
      typeof data.path === "string" &&
      typeof data.signature === "string" &&
      typeof data.format === "string" &&
      ["raw", "datetime"].includes(data.format) &&
      (data.coin_ref === undefined || data.coin_ref === null)
    );
  }

  private isFieldFilterV2WithCoinRef(
    data: FilterField,
  ): data is FilterFieldV2WithCoinRef {
    return (
      typeof data === "object" &&
      typeof data.label === "string" &&
      typeof data.path === "string" &&
      typeof data.signature === "string" &&
      typeof data.format === "string" &&
      ["token", "amount"].includes(data.format) &&
      typeof data.coin_ref === "number"
    );
  }

  private sortTypes(types: TypedDataSchema): TypedDataSchema {
    return Object.fromEntries(
      Object.entries(types)
        .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
        .map(([key, value]) => [
          key,
          value.map((v) => ({ name: v.name, type: v.type })),
        ]),
    );
  }
}
