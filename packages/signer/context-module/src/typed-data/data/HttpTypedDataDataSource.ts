import axios from "axios";
import SHA224 from "crypto-js/sha224";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type {
  ContextModuleCalMode,
  ContextModuleConfig,
} from "@/config/model/ContextModuleConfig";
import type {
  TypedDataFilter,
  TypedDataMessageInfo,
} from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataSchema } from "@/shared/model/TypedDataContext";
import PACKAGE from "@root/package.json";

import type {
  FiltersDto,
  InstructionContractInfo,
  InstructionField,
  InstructionFieldV1,
  InstructionFieldV2,
  InstructionFieldV2WithCoinRef,
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
    let messageInfo: TypedDataMessageInfo | undefined = undefined;

    try {
      const response = await axios.request<FiltersDto[]>({
        method: "GET",
        url: `${this.config.cal.url}/dapps`,
        params: {
          contracts: address,
          chain_id: chainId,
          output: "descriptors_eip712",
          descriptors_eip712_version: version,
          descriptors_eip712: "<set>",
          ref: `branch:${this.config.cal.branch}`,
        },
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      // Try to get the filters JSON descriptor, from address and schema hash
      const schemaHash = SHA224(
        JSON.stringify(this.sortTypes(schema)).replace(" ", ""),
      ).toString();
      address = address.toLowerCase();
      const filtersJson =
        response.data?.[0]?.descriptors_eip712?.[address]?.[schemaHash];
      if (!filtersJson) {
        return Left(
          new Error(
            `[ContextModule] HttpTypedDataDataSource: no typed data filters for address ${address} on chain ${chainId} for schema ${schemaHash}`,
          ),
        );
      }

      // Parse the message type, if available
      if (!filtersJson.schema || !Array.isArray(filtersJson.instructions)) {
        return Left(
          new Error(
            `[ContextModule] HttpTypedDataDataSource: no message info for address ${address} on chain ${chainId} for schema ${schemaHash}`,
          ),
        );
      }

      // Parse all the filters
      const filters: TypedDataFilter[] = [];
      for (const field of filtersJson.instructions) {
        if (this.isInstructionContractInfo(field, this.config.cal.mode)) {
          messageInfo = {
            displayName: field.display_name,
            signature: field.signatures[this.config.cal.mode],
            filtersCount: field.field_mappers_count,
          };
        } else if (
          version === "v1" &&
          this.isInstructionFieldV1(field, this.config.cal.mode)
        ) {
          filters.push({
            type: "raw",
            displayName: field.display_name,
            path: field.field_path,
            signature: field.signatures[this.config.cal.mode],
          });
        } else if (this.isInstructionFieldV2(field, this.config.cal.mode)) {
          filters.push({
            type: field.format,
            displayName: field.display_name,
            path: field.field_path,
            signature: field.signatures[this.config.cal.mode],
          });
        } else if (
          this.isInstructionFieldV2WithCoinRef(field, this.config.cal.mode)
        ) {
          filters.push({
            type: field.format,
            displayName: field.display_name,
            path: field.field_path,
            signature: field.signatures[this.config.cal.mode],
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

      if (!messageInfo) {
        return Left(
          new Error(
            `[ContextModule] HttpTypedDataDataSource: no message info for address ${address} on chain ${chainId} for schema ${schemaHash}`,
          ),
        );
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

  private isInstructionFieldV1(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionFieldV1 & {
    signatures: { [key in ContextModuleCalMode]: string };
  } {
    // NOTE: Currently the backend return the same structure for V1 and V2,
    // so we can't distinguish them here, but we can still check the required fields
    return (
      typeof data === "object" &&
      typeof data.display_name === "string" &&
      typeof data.field_path === "string" &&
      typeof data.signatures === "object" &&
      typeof data.signatures[mode] === "string"
    );
  }

  private isInstructionFieldV2(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionFieldV2 & {
    signatures: { [key in ContextModuleCalMode]: string };
  } {
    return (
      typeof data === "object" &&
      typeof data.display_name === "string" &&
      typeof data.field_path === "string" &&
      typeof data.signatures === "object" &&
      typeof data.signatures[mode] === "string" &&
      typeof data.format === "string" &&
      ["raw", "datetime"].includes(data.format) &&
      data.coin_ref === undefined
    );
  }

  private isInstructionFieldV2WithCoinRef(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionFieldV2WithCoinRef & {
    signatures: { [key in ContextModuleCalMode]: string };
  } {
    return (
      typeof data === "object" &&
      typeof data.display_name === "string" &&
      typeof data.field_path === "string" &&
      typeof data.signatures === "object" &&
      typeof data.signatures[mode] === "string" &&
      typeof data.format === "string" &&
      ["token", "amount"].includes(data.format) &&
      typeof data.coin_ref === "number"
    );
  }

  private isInstructionContractInfo(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionContractInfo & {
    signatures: { [key in ContextModuleCalMode]: string };
  } {
    return (
      typeof data === "object" &&
      typeof data.display_name === "string" &&
      typeof data.field_mappers_count === "number" &&
      typeof data.signatures === "object" &&
      typeof data.signatures[mode] === "string" &&
      data.field_path === undefined
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
