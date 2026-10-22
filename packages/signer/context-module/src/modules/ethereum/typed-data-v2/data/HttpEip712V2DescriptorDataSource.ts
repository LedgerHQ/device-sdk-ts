import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleCalMode,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { type CalldataTransactionDescriptor } from "@/modules/ethereum/calldata/data/dto/CalldataDto";
import {
  type Eip712PathElement,
  type Eip712ValuePath,
} from "@/modules/ethereum/model/Eip712Path";
import {
  ClearSignContextReferenceType,
  type Eip712ClearSignContextReference,
} from "@/modules/ethereum/model/EthereumClearSignContext";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { INFO_SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";

import {
  type Eip712V2Descriptor,
  type Eip712V2DescriptorDto,
  type Eip712V2ParamDto,
  type Eip712V2PathElementDto,
  type Eip712V2ValueDto,
} from "./dto/Eip712V2DescriptorDto";
import {
  Eip712V2DescriptorDataSource,
  GetEip712V2DescriptorsParams,
} from "./Eip712V2DescriptorDataSource";

/** A descriptor whose message info is signed for the CAL mode in use */
type SignedDescriptor = Eip712V2Descriptor & {
  message_info: {
    descriptor: { signatures: { [_key in ContextModuleCalMode]: string } };
  };
};

@injectable()
export class HttpEip712V2DescriptorDataSource
  implements Eip712V2DescriptorDataSource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getDescriptors({
    verifyingContract,
    chainId,
    primaryTypeHash,
    deviceModelId,
  }: GetEip712V2DescriptorsParams): Promise<
    Either<Error, ClearSignContextSuccess[]>
  > {
    let dto: Eip712V2DescriptorDto[] | undefined;
    try {
      dto = (await this.http.get(`${this.config.cal.url}/dapps`, {
        params: {
          output: "descriptors_calldata_eip712",
          chain_id: chainId,
          contracts: verifyingContract,
          ref: `branch:${this.config.cal.branch}`,
        },
      })) as Eip712V2DescriptorDto[];
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpEip712V2DescriptorDataSource: Failed to fetch EIP-712 V2 descriptors: ${error}`,
        ),
      );
    }

    if (!Array.isArray(dto)) {
      return Left(
        new Error(
          `[ContextModule] HttpEip712V2DescriptorDataSource: Response is not an array`,
        ),
      );
    }

    const address = verifyingContract.toLowerCase();
    const typeHash = `0x${primaryTypeHash.replace(/^0x/i, "").toLowerCase()}`;
    const descriptor = dto
      .map((item) => item?.descriptors_calldata_eip712?.[address]?.[typeHash])
      .find(
        (item): item is SignedDescriptor =>
          item !== undefined && this.isDescriptor(item, chainId),
      );

    if (descriptor === undefined) {
      return Left(
        new Error(
          `[ContextModule] HttpEip712V2DescriptorDataSource: No EIP-712 V2 descriptor for contract ${address} on chain ${chainId} for primary type hash ${typeHash}`,
        ),
      );
    }

    const fields = Either.sequence(
      descriptor.fields.map((field) =>
        this.getReference(field.param).map<ClearSignContextSuccess>(
          (reference) => ({
            type: ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
            payload: field.descriptor,
            reference,
          }),
        ),
      ),
    );
    if (fields.isLeft()) {
      return Left(fields.extract());
    }

    // The device verifies the message info and its enums with the key it uses for the
    // calldata descriptors, which the typed message ones share their wire format with.
    const certificate = await this._certificateLoader.loadCertificate({
      targetDevice: deviceModelId,
      keyUsage: KeyUsage.Calldata,
      keyId: KeyId.CalCalldataKey,
    });

    const { mode } = this.config.cal;
    const info: ClearSignContextSuccess = {
      type: ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
      payload: HexStringUtils.appendSignatureToPayload(
        descriptor.message_info.descriptor.data,
        descriptor.message_info.descriptor.signatures[mode],
        INFO_SIGNATURE_TAG,
      ),
      certificate,
    };

    const enums: ClearSignContextSuccess[] = [];
    for (const [id, values] of Object.entries(descriptor.enums)) {
      for (const [
        value,
        { data, signatures },
      ] of Object.entries<CalldataTransactionDescriptor>(values)) {
        const signature = signatures[mode];
        if (signature === undefined) {
          continue;
        }
        enums.push({
          type: ClearSignContextType.ETHEREUM_ENUM,
          id: Number(id),
          value: Number(value),
          payload: HexStringUtils.appendSignatureToPayload(
            data,
            signature,
            INFO_SIGNATURE_TAG,
          ),
          certificate,
        });
      }
    }

    // The fields keep the order CAL returns them in: FIELDS_HASH is computed over them
    // in that order, and the device refuses any other.
    return Right([info, ...enums, ...fields.unsafeCoerce()]);
  }

  private isDescriptor(
    data: Eip712V2Descriptor,
    chainId: number,
  ): data is SignedDescriptor {
    return (
      typeof data === "object" &&
      data.type === "eip712" &&
      data.version === "v1" &&
      data.chain_id === chainId &&
      typeof data.message_info?.descriptor?.data === "string" &&
      typeof data.message_info.descriptor.signatures?.[this.config.cal.mode] ===
        "string" &&
      typeof data.enums === "object" &&
      Array.isArray(data.fields) &&
      data.fields.every(
        (field) =>
          typeof field?.descriptor === "string" &&
          typeof field.param?.type === "string",
      )
    );
  }

  /**
   * The context a descriptor needs to be formatted, sent before it: the token, NFT or
   * trusted name its value is the address of, or the enum entry its value is.
   */
  private getReference(
    param: Eip712V2ParamDto,
  ): Either<Error, Eip712ClearSignContextReference | undefined> {
    switch (param.type) {
      case "TOKEN_AMOUNT":
        return param.token === undefined
          ? Right(undefined)
          : this.getPathOrValue(param.token).map((pathOrValue) => ({
              type: ClearSignContextReferenceType.TOKEN,
              ...pathOrValue,
            }));
      case "NFT":
        return this.getPathOrValue(param.collection).map((pathOrValue) => ({
          type: ClearSignContextReferenceType.NFT,
          ...pathOrValue,
        }));
      case "TRUSTED_NAME":
        return this.getValuePath(param.value).map((valuePath) => ({
          type: ClearSignContextReferenceType.TRUSTED_NAME,
          valuePath,
          types: param.types,
          sources: param.sources,
        }));
      case "ENUM":
        return this.getValuePath(param.value).map((valuePath) => ({
          type: ClearSignContextReferenceType.ENUM,
          valuePath,
          id: param.id,
        }));
      case "CALLDATA":
        return Right({ type: ClearSignContextReferenceType.CALLDATA });
      default:
        return Right(undefined);
    }
  }

  private getPathOrValue(
    value: Eip712V2ValueDto,
  ): Either<Error, { valuePath: Eip712ValuePath } | { value: string }> {
    if (value.type === "constant") {
      return Right({ value: value.value });
    }
    return this.getValuePath(value).map((valuePath) => ({ valuePath }));
  }

  private getValuePath(
    value: Eip712V2ValueDto,
  ): Either<Error, Eip712ValuePath> {
    if (value.type !== "path") {
      return Left(
        new Error(
          `[ContextModule] HttpEip712V2DescriptorDataSource: Expected a path, got a ${value.type}`,
        ),
      );
    }
    const path = value.binary_path;
    if (path.type === "CONTAINER") {
      return Right(path.value);
    }
    if (path.type !== "EIP712" || !Array.isArray(path.elements)) {
      return Left(
        new Error(
          `[ContextModule] HttpEip712V2DescriptorDataSource: Unsupported path ${JSON.stringify(path)}`,
        ),
      );
    }
    return Either.sequence(path.elements.map((e) => this.toPathElement(e)));
  }

  private toPathElement(
    element: Eip712V2PathElementDto,
  ): Either<Error, Eip712PathElement> {
    switch (element.type) {
      case "struct_field":
        return Right({ type: "STRUCT_FIELD", index: element.index });
      case "array_slice":
        return Right({
          type: "ARRAY_SLICE",
          start: element.start,
          end: element.end,
        });
      case "leaf_slice":
        return Right({
          type: "LEAF_SLICE",
          start: element.start,
          end: element.end,
        });
      default:
        return Left(
          new Error(
            `[ContextModule] HttpEip712V2DescriptorDataSource: Unsupported path element ${JSON.stringify(element)}`,
          ),
        );
    }
  }
}
