import axios from "axios";
import SHA224 from "crypto-js/sha224";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type {
  ContextModuleCalMode,
  ContextModuleConfig,
} from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import type {
  TypedDataCalldataIndex,
  TypedDataFilter,
  TypedDataFilterCalldataInfo,
  TypedDataMessageInfo,
} from "@/shared/model/TypedDataClearSignContext";
import { TypedDataCalldataParamPresence } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataSchema } from "@/shared/model/TypedDataContext";
import PACKAGE from "@root/package.json";

import type {
  FiltersDto,
  InstructionCalldataInfo,
  InstructionCalldataParamPresence,
  InstructionContractInfo,
  InstructionField,
  InstructionFieldV1,
  InstructionFieldV2,
  InstructionFieldV2Calldata,
  InstructionFieldV2WithCoinRef,
  InstructionFieldV2WithName,
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
          // TODO revert to branch
          ref: `commit:c9227c39e225932796e87ef4c9eb84f647e16150`,
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
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
      const calldatasInfos: Record<
        TypedDataCalldataIndex,
        TypedDataFilterCalldataInfo
      > = {};
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
        } else if (
          this.isInstructionFieldV2WithName(field, this.config.cal.mode)
        ) {
          filters.push({
            type: field.format,
            displayName: field.display_name,
            path: field.field_path,
            signature: field.signatures[this.config.cal.mode],
            types: field.name_types,
            sources: field.name_sources,
            typesAndSourcesPayload:
              this.formatTrustedNameTypesAndSources(field),
          });
        } else if (
          this.isInstructionCalldataInfo(field, this.config.cal.mode)
        ) {
          calldatasInfos[field.calldata_index] = {
            displayName: field.display_name,
            calldataIndex: field.calldata_index,
            valueFlag: field.value_filter_flag,
            calleeFlag: this.convertCalldataPresenceFlag(
              field.callee_filter_flag,
            ),
            amountFlag: field.amount_filter_flag,
            spenderFlag: this.convertCalldataPresenceFlag(
              field.spender_filter_flag,
            ),
            chainIdFlag: field.chain_id_filter_flag,
            selectorFlag: field.selector_filter_flag,
            signature: field.signatures[this.config.cal.mode],
          };
        } else if (
          this.isInstructionFieldV2Calldata(field, this.config.cal.mode)
        ) {
          filters.push({
            type: field.format,
            displayName: field.display_name,
            path: field.field_path,
            signature: field.signatures[this.config.cal.mode],
            calldataIndex: field.calldata_index,
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

      return Right({ messageInfo, filters, calldatasInfos });
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTypedDataDataSource: Failed to fetch typed data informations",
        ),
      );
    }
  }

  private convertCalldataPresenceFlag(
    flag: InstructionCalldataParamPresence,
  ): TypedDataCalldataParamPresence {
    switch (flag) {
      case "none":
        return TypedDataCalldataParamPresence.None;
      case "present":
        return TypedDataCalldataParamPresence.Present;
      case "verifying_contract":
        return TypedDataCalldataParamPresence.VerifyingContract;
      default: {
        const uncoveredFlag: never = flag;
        throw new Error(`Unhandled flag: ${uncoveredFlag}`);
      }
    }
  }

  private formatTrustedNameTypesAndSources(
    field: InstructionFieldV2WithName,
  ): string {
    // Get number of types and sources
    const typesCount = field.name_types.length;
    const sourcesCount = field.name_sources.length;

    // Extract types and sources from the descriptor
    const types = field.descriptor.slice(
      (typesCount + sourcesCount) * 2 * -1,
      sourcesCount * 2 * -1,
    );
    const sources = field.descriptor.slice(sourcesCount * 2 * -1);

    // Convert counts into hex strings
    const typesCountHex = typesCount.toString(16).padStart(2, "0");
    const sourcesCountHex = sourcesCount.toString(16).padStart(2, "0");

    // Return the payload
    return typesCountHex + types + sourcesCountHex + sources;
  }

  private isInstructionFieldV1(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionFieldV1 & {
    signatures: { [_key in ContextModuleCalMode]: string };
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
    signatures: { [_key in ContextModuleCalMode]: string };
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
    signatures: { [_key in ContextModuleCalMode]: string };
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

  private isInstructionFieldV2WithName(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionFieldV2WithName & {
    signatures: { [_key in ContextModuleCalMode]: string };
  } {
    return (
      typeof data === "object" &&
      typeof data.display_name === "string" &&
      typeof data.field_path === "string" &&
      typeof data.signatures === "object" &&
      typeof data.signatures[mode] === "string" &&
      typeof data.format === "string" &&
      data.format === "trusted-name" &&
      data.coin_ref === undefined &&
      Array.isArray(data.name_types) &&
      Array.isArray(data.name_sources) &&
      data.name_types.every((t) => typeof t === "string") &&
      data.name_sources.every((s) => typeof s === "string")
    );
  }

  private isInstructionContractInfo(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionContractInfo & {
    signatures: { [_key in ContextModuleCalMode]: string };
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

  private isInstructionCalldataInfo(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionCalldataInfo & {
    signatures: { [_key in ContextModuleCalMode]: string };
  } {
    return (
      typeof data === "object" &&
      typeof data.type === "string" &&
      data.type === "calldata" &&
      typeof data.display_name === "string" &&
      typeof data.calldata_index === "number" &&
      typeof data.value_filter_flag === "boolean" &&
      typeof data.chain_id_filter_flag === "boolean" &&
      typeof data.selector_filter_flag === "boolean" &&
      typeof data.amount_filter_flag === "boolean" &&
      ["none", "present", "verifying_contract"].includes(
        data.callee_filter_flag,
      ) &&
      ["none", "present", "verifying_contract"].includes(
        data.spender_filter_flag,
      ) &&
      typeof data.signatures === "object" &&
      typeof data.signatures[mode] === "string"
    );
  }

  private isInstructionFieldV2Calldata(
    data: InstructionField,
    mode: ContextModuleCalMode,
  ): data is InstructionFieldV2Calldata & {
    signatures: { [_key in ContextModuleCalMode]: string };
  } {
    return (
      typeof data === "object" &&
      typeof data.display_name === "string" &&
      typeof data.field_path === "string" &&
      typeof data.signatures === "object" &&
      typeof data.signatures[mode] === "string" &&
      typeof data.format === "string" &&
      [
        "calldata-value",
        "calldata-callee",
        "calldata-chain-id",
        "calldata-selector",
        "calldata-amount",
        "calldata-spender",
      ].includes(data.format) &&
      typeof data.calldata_index === "number"
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
