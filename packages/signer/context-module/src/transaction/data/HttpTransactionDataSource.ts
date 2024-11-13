import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type {
  ContextModuleCalMode,
  ContextModuleConfig,
} from "@/config/model/ContextModuleConfig";
import {
  ClearSignContextReference,
  ClearSignContextSuccess,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { GenericPath } from "@/shared/model/GenericPath";
import PACKAGE from "@root/package.json";

import {
  CalldataDescriptor,
  CalldataDescriptorContainerPathV1,
  CalldataDescriptorParam,
  CalldataDescriptorPathElementsV1,
  CalldataDescriptorPathElementV1,
  CalldataDescriptorV1,
  CalldataDescriptorValueV1,
  CalldataDto,
  CalldataEnumV1,
  CalldataFieldV1,
  CalldataTransactionInfoV1,
} from "./CalldataDto";
import {
  GetTransactionDescriptorsParams,
  TransactionDataSource,
} from "./TransactionDataSource";

@injectable()
export class HttpTransactionDataSource implements TransactionDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}
  public async getTransactionDescriptors({
    chainId,
    address,
    selector,
  }: GetTransactionDescriptorsParams): Promise<
    Either<Error, ClearSignContextSuccess[]>
  > {
    let calldata: CalldataDto | undefined;
    try {
      const response = await axios.request<CalldataDto[]>({
        method: "GET",
        url: `${this.config.cal.url}/dapps`,
        params: {
          output: "descriptors_calldata",
          chain_id: chainId,
          contracts: address,
          ref: `branch:${this.config.cal.branch}`,
        },
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });
      calldata = response.data?.[0];
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpTransactionDataSource: Failed to fetch transaction informations: ${error}`,
        ),
      );
    }

    if (!calldata) {
      return Left(
        new Error(
          `[ContextModule] HttpTransactionDataSource: No generic descriptor for contract ${address}`,
        ),
      );
    }

    // Normalize the address and selector
    address = address.toLowerCase();
    selector = `0x${selector.slice(2).toLowerCase()}`;

    const calldataDescriptor =
      calldata.descriptors_calldata?.[address]?.[selector];
    if (!calldataDescriptor) {
      return Left(
        new Error(
          `[ContextModule] HttpTransactionDataSource: Invalid response for contract ${address} and selector ${selector}`,
        ),
      );
    }

    if (
      !this.isCalldataDescriptorV1(calldataDescriptor, this.config.cal.mode)
    ) {
      return Left(
        new Error(
          `[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract ${address} and selector ${selector}`,
        ),
      );
    }

    const infoData = calldataDescriptor.transaction_info.descriptor.data;
    const infoSignature =
      calldataDescriptor.transaction_info.descriptor.signatures[
        this.config.cal.mode
      ];
    const info: ClearSignContextSuccess = {
      type: ClearSignContextType.TRANSACTION_INFO,
      payload: `${infoData}${infoSignature}`,
    };
    const enums: ClearSignContextSuccess[] = calldataDescriptor.enums.map(
      (e) => ({
        type: ClearSignContextType.ENUM,
        payload: e.descriptor,
      }),
    );
    const fields: ClearSignContextSuccess[] = calldataDescriptor.fields.map(
      (field) => ({
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: field.descriptor,
        reference: this.getReference(field.param),
      }),
    );
    return Right([info, ...enums, ...fields]);
  }

  private getReference(
    param: CalldataDescriptorParam,
  ): ClearSignContextReference | undefined {
    if (param.type === "TOKEN_AMOUNT" && param.token !== undefined) {
      return {
        type: ClearSignContextType.TOKEN,
        valuePath: this.toGenericPath(param.token.binary_path),
      };
    } else if (param.type === "NFT") {
      return {
        type: ClearSignContextType.NFT,
        valuePath: this.toGenericPath(param.collection.binary_path),
      };
    } else if (param.type === "TRUSTED_NAME") {
      return {
        type: ClearSignContextType.TRUSTED_NAME,
        valuePath: this.toGenericPath(param.value.binary_path),
        types: param.types,
        sources: param.sources,
      };
    }
    return undefined;
  }

  private toGenericPath(
    path: CalldataDescriptorContainerPathV1 | CalldataDescriptorPathElementsV1,
  ): GenericPath {
    if (typeof path !== "object") {
      return path;
    }
    return path.elements.map((element) => {
      if (element.type === "ARRAY") {
        const { weight: itemSize, ...rest } = element;
        return {
          itemSize,
          ...rest,
        };
      } else if (element.type === "LEAF") {
        const { leaf_type: leafType, ...rest } = element;
        return {
          leafType,
          ...rest,
        };
      }
      return element;
    });
  }

  private isCalldataDescriptorV1(
    data: CalldataDescriptor,
    mode: ContextModuleCalMode,
  ): data is CalldataDescriptorV1 & {
    transaction_info: {
      descriptor: {
        signatures: { [key in ContextModuleCalMode]: string };
      };
    };
  } {
    return (
      typeof data === "object" &&
      data.type === "calldata" &&
      data.version === "v1" &&
      this.isTransactionInfoV1(data.transaction_info, mode) &&
      Array.isArray(data.enums) &&
      Array.isArray(data.fields) &&
      data.enums.every((e) => this.isEnumV1(e)) &&
      data.fields.every((f) => this.isFieldV1(f))
    );
  }

  private isTransactionInfoV1(
    data: CalldataTransactionInfoV1,
    mode: ContextModuleCalMode,
  ): data is CalldataTransactionInfoV1 & {
    descriptor: {
      signatures: { [key in ContextModuleCalMode]: string };
    };
  } {
    return (
      typeof data === "object" &&
      typeof data.descriptor === "object" &&
      typeof data.descriptor.data === "string" &&
      typeof data.descriptor.signatures === "object" &&
      typeof data.descriptor.signatures[mode] === "string"
    );
  }

  private isEnumV1(data: CalldataEnumV1): boolean {
    return typeof data === "object" && typeof data.descriptor === "string";
  }

  private isFieldV1(data: CalldataFieldV1): boolean {
    return (
      typeof data === "object" &&
      typeof data.descriptor === "string" &&
      typeof data.param === "object" &&
      typeof data.param.value === "object" &&
      this.isDescriptorValueV1(data.param.value) &&
      (data.param.type === "RAW" ||
        data.param.type === "AMOUNT" ||
        data.param.type === "DATETIME" ||
        data.param.type === "DURATION" ||
        data.param.type === "UNIT" ||
        data.param.type === "ENUM" ||
        (data.param.type === "NFT" &&
          this.isDescriptorValueV1(data.param.collection)) ||
        (data.param.type === "TOKEN_AMOUNT" &&
          (data.param.token === undefined ||
            this.isDescriptorValueV1(data.param.token))) ||
        (data.param.type === "TRUSTED_NAME" &&
          Array.isArray(data.param.types) &&
          Array.isArray(data.param.sources) &&
          data.param.types.every((t) => typeof t === "string") &&
          data.param.sources.every((t) => typeof t === "string")))
    );
  }

  private isDescriptorValueV1(data: CalldataDescriptorValueV1): boolean {
    return (
      typeof data === "object" &&
      typeof data.type_family === "string" &&
      [
        "UINT",
        "INT",
        "UFIXED",
        "FIXED",
        "ADDRESS",
        "BOOL",
        "BYTES",
        "STRING",
      ].includes(data.type_family) &&
      (typeof data.type_size === "undefined" ||
        typeof data.type_size === "number") &&
      ((typeof data.binary_path === "string" &&
        ["FROM", "TO", "VALUE"].includes(data.binary_path)) ||
        (typeof data.binary_path === "object" &&
          Array.isArray(data.binary_path.elements) &&
          data.binary_path.elements.every((e) => this.isPathElementV1(e))))
    );
  }

  private isPathElementV1(data: CalldataDescriptorPathElementV1): boolean {
    return (
      typeof data === "object" &&
      (data.type === "REF" ||
        (data.type === "TUPLE" && typeof data.offset === "number") ||
        (data.type === "ARRAY" &&
          typeof data.weight === "number" &&
          (typeof data.start === "undefined" ||
            typeof data.start === "number") &&
          (typeof data.length === "undefined" ||
            typeof data.length === "number")) ||
        (data.type === "LEAF" &&
          typeof data.leaf_type === "string" &&
          ["ARRAY_LEAF", "TUPLE_LEAF", "STATIC_LEAF", "DYNAMIC_LEAF"].includes(
            data.leaf_type,
          )) ||
        (data.type === "SLICE" &&
          (typeof data.start === "undefined" ||
            typeof data.start === "number") &&
          (typeof data.end === "undefined" || typeof data.end === "number")))
    );
  }
}
