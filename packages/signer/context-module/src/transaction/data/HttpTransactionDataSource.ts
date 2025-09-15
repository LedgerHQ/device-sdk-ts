import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleCalMode,
  type ContextModuleConfig,
} from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { PkiCertificate } from "@/pki/model/PkiCertificate";
import { PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import {
  ClearSignContextReference,
  ClearSignContextReferenceType,
  ClearSignContextSuccess,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { GenericPath } from "@/shared/model/GenericPath";
import { INFO_SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";
import PACKAGE from "@root/package.json";

import {
  CalldataDescriptor,
  CalldataDescriptorContainerPathV1,
  CalldataDescriptorParam,
  CalldataDescriptorPathElementsV1,
  CalldataDescriptorPathElementV1,
  CalldataDescriptorV1,
  CalldataDescriptorValueBinaryPathV1,
  CalldataDescriptorValueConstantV1,
  CalldataDescriptorValueV1,
  CalldataDto,
  CalldataEnumV1,
  CalldataFieldV1,
  CalldataSignatures,
  CalldataTransactionDescriptor,
  CalldataTransactionInfoV1,
} from "./dto/CalldataDto";
import {
  GetTransactionDescriptorsParams,
  TransactionDataSource,
} from "./TransactionDataSource";

@injectable()
export class HttpTransactionDataSource implements TransactionDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
  ) {}

  public async getTransactionDescriptors({
    chainId,
    address,
    selector,
    deviceModelId,
  }: GetTransactionDescriptorsParams): Promise<
    Either<Error, ClearSignContextSuccess[]>
  > {
    let dto: CalldataDto[] | undefined;
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
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });
      dto = response.data;
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpTransactionDataSource: Failed to fetch transaction informations: ${error}`,
        ),
      );
    }

    if (!Array.isArray(dto)) {
      return Left(
        new Error(
          `[ContextModule] HttpTransactionDataSource: Response is not an array`,
        ),
      );
    }

    if (dto.length === 0) {
      return Left(
        new Error(
          `[ContextModule] HttpTransactionDataSource: No data for contract ${address} and selector ${selector}`,
        ),
      );
    }

    for (const calldata of dto) {
      // Normalize the address and selector
      address = address.toLowerCase();
      selector = `0x${selector.slice(2).toLowerCase()}`;
      const calldataDescriptor =
        calldata.descriptors_calldata?.[address]?.[selector];

      if (
        !calldataDescriptor ||
        !this.isCalldataDescriptorV1(calldataDescriptor, this.config.cal.mode)
      ) {
        continue;
      }

      const infoData = calldataDescriptor.transaction_info.descriptor.data;
      const infoSignature =
        calldataDescriptor.transaction_info.descriptor.signatures[
          this.config.cal.mode
        ];

      const certificateInfos: PkiCertificateInfo = {
        targetDevice: deviceModelId,
        keyUsage: KeyUsage.Calldata,
        keyId: KeyId.CalCalldataKey,
      };
      const certificate: PkiCertificate | undefined =
        await this._certificateLoader.loadCertificate(certificateInfos);

      const info: ClearSignContextSuccess = {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: HexStringUtils.appendSignatureToPayload(
          infoData,
          infoSignature,
          INFO_SIGNATURE_TAG,
        ),
        certificate,
      };

      const enums: ClearSignContextSuccess[] = [];
      for (const [id, values] of Object.entries(calldataDescriptor.enums)) {
        for (const [
          value,
          { data, signatures },
        ] of Object.entries<CalldataTransactionDescriptor>(values)) {
          enums.push({
            type: ClearSignContextType.ENUM,
            id: Number(id),
            value: Number(value),
            payload: HexStringUtils.appendSignatureToPayload(
              data,
              signatures[this.config.cal.mode]!,
              INFO_SIGNATURE_TAG,
            ),
            certificate,
          });
        }
      }

      const fields: ClearSignContextSuccess[] = calldataDescriptor.fields.map(
        (field) => ({
          type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          payload: field.descriptor,
          reference: this.getReference(field.param),
        }),
      );
      return Right([info, ...enums, ...fields]);
    }

    return Left(
      new Error(
        `[ContextModule] HttpTransactionDataSource: Invalid response for contract ${address} and selector ${selector}`,
      ),
    );
  }

  private getReference(
    param: CalldataDescriptorParam,
  ): ClearSignContextReference | undefined {
    if (
      param.type === "TOKEN_AMOUNT" &&
      param.token !== undefined &&
      param.token.type === "path"
    ) {
      return {
        type: ClearSignContextReferenceType.TOKEN,
        valuePath: this.toGenericPath(param.token.binary_path),
      };
    } else if (
      param.type === "TOKEN_AMOUNT" &&
      param.token !== undefined &&
      param.token.type === "constant"
    ) {
      return {
        type: ClearSignContextReferenceType.TOKEN,
        value: param.token.value,
      };
    } else if (param.type === "NFT" && param.collection.type === "path") {
      return {
        type: ClearSignContextReferenceType.NFT,
        valuePath: this.toGenericPath(param.collection.binary_path),
      };
    } else if (param.type === "NFT" && param.collection.type === "constant") {
      return {
        type: ClearSignContextReferenceType.NFT,
        value: param.collection.value,
      };
    } else if (param.type === "TRUSTED_NAME" && param.value.type === "path") {
      return {
        type: ClearSignContextReferenceType.TRUSTED_NAME,
        valuePath: this.toGenericPath(param.value.binary_path),
        types: param.types,
        sources: param.sources,
      };
    } else if (param.type === "ENUM" && param.value.type === "path") {
      return {
        type: ClearSignContextReferenceType.ENUM,
        valuePath: this.toGenericPath(param.value.binary_path),
        id: param.id,
      };
    } else if (
      param.type === "CALLDATA" &&
      param.value.type === "path" &&
      param.callee.type === "path"
    ) {
      return {
        type: ClearSignContextReferenceType.CALLDATA,
        valuePath: this.toGenericPath(param.value.binary_path),
        callee: this.toGenericPath(param.callee.binary_path),
        selector:
          param.selector?.type === "path"
            ? this.toGenericPath(param.selector.binary_path)
            : undefined,
        amount:
          param.amount?.type === "path"
            ? this.toGenericPath(param.amount.binary_path)
            : undefined,
        spender:
          param.spender?.type === "path"
            ? this.toGenericPath(param.spender.binary_path)
            : undefined,
        chainId:
          param.chainId?.type === "path"
            ? this.toGenericPath(param.chainId.binary_path)
            : undefined,
      };
    }
    return undefined;
  }

  private toGenericPath(
    path: CalldataDescriptorContainerPathV1 | CalldataDescriptorPathElementsV1,
  ): GenericPath {
    if (path.type === "CONTAINER") {
      return path.value;
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
        signatures: { [_key in ContextModuleCalMode]: string };
      };
    };
  } {
    return (
      typeof data === "object" &&
      data.type === "calldata" &&
      data.version === "v1" &&
      this.isTransactionInfoV1(data.transaction_info, mode) &&
      this.isEnumV1(data.enums, mode) &&
      Array.isArray(data.fields) &&
      data.fields.every((f) => this.isFieldV1(f))
    );
  }

  private isTransactionInfoV1(
    data: CalldataTransactionInfoV1,
    mode: ContextModuleCalMode,
  ): data is CalldataTransactionInfoV1 & {
    descriptor: {
      signatures: { [_key in ContextModuleCalMode]: string };
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

  private isEnumV1(
    calldata: CalldataEnumV1,
    mode: ContextModuleCalMode,
  ): calldata is CalldataEnumV1 {
    return (
      typeof calldata === "object" &&
      Object.entries(calldata).every(
        ([id, values]) =>
          typeof id === "string" &&
          typeof values === "object" &&
          Object.entries<CalldataTransactionDescriptor>(values).every(
            ([value, obj]) =>
              typeof value === "string" &&
              typeof obj === "object" &&
              typeof obj.data === "string" &&
              obj.signatures !== undefined &&
              this.isCalldataSignatures(obj.signatures, mode),
          ),
      )
    );
  }

  private isCalldataSignatures(
    data: CalldataSignatures,
    mode: ContextModuleCalMode,
  ): data is CalldataSignatures & { [_key in ContextModuleCalMode]: string } {
    return typeof data === "object" && typeof data[mode] === "string";
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
          data.param.sources.every((t) => typeof t === "string")) ||
        (data.param.type === "CALLDATA" &&
          this.isDescriptorValueV1(data.param.value) &&
          this.isDescriptorValueV1(data.param.callee) &&
          (data.param.selector === undefined ||
            this.isDescriptorValueV1(data.param.selector)) &&
          (data.param.amount === undefined ||
            this.isDescriptorValueV1(data.param.amount)) &&
          (data.param.spender === undefined ||
            this.isDescriptorValueV1(data.param.spender)) &&
          (data.param.chainId === undefined ||
            this.isDescriptorValueV1(data.param.chainId))))
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
      ((data.type === "path" &&
        this.isCalldataDescriptorValueBinaryPathV1(data)) ||
        (data.type === "constant" &&
          this.isCalldataDescriptorValueConstantV1(data)))
    );
  }

  private isCalldataDescriptorValueConstantV1(
    data: CalldataDescriptorValueConstantV1,
  ): boolean {
    return (
      typeof data === "object" &&
      data.type === "constant" &&
      typeof data.value === "string"
    );
  }

  private isCalldataDescriptorValueBinaryPathV1(
    data: CalldataDescriptorValueBinaryPathV1,
  ): boolean {
    return (
      typeof data === "object" &&
      ((data.type === "path" &&
        data.binary_path.type === "CONTAINER" &&
        ["FROM", "TO", "VALUE"].includes(data.binary_path.value)) ||
        (data.binary_path.type === "DATA" &&
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
          (typeof data.end === "undefined" || typeof data.end === "number")) ||
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
