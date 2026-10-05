import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type {
  ContextModuleCalMode,
  ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { getPrimaryTypeHash } from "@/modules/ethereum/typed-data/utils/getPrimaryTypeHash";
import { INFO_SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";

import {
  GetTypedDataDescriptorsParams,
  GetTypedDataDescriptorsResult,
  TypedDataDescriptorDataSource,
} from "./TypedDataDescriptorDataSource";
import type {
  TypedDataDescriptorDto,
  TypedDataDescriptorV1,
} from "./TypedDataDescriptorDto";

@injectable()
export class HttpTypedDataDescriptorDataSource
  implements TypedDataDescriptorDataSource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getTypedDataDescriptors({
    address,
    chainId,
    schema,
    primaryType,
  }: GetTypedDataDescriptorsParams): Promise<
    Either<Error, GetTypedDataDescriptorsResult>
  > {
    let dto: TypedDataDescriptorDto[] | undefined;
    try {
      dto = (await this.http.get(`${this.config.cal.url}/dapps`, {
        params: {
          contracts: address,
          chain_id: chainId,
          output: "descriptors_calldata_eip712",
          ref: `branch:${this.config.cal.branch}`,
        },
      })) as TypedDataDescriptorDto[];
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpTypedDataDescriptorDataSource: Failed to fetch typed data descriptors: ${error}`,
        ),
      );
    }

    if (!Array.isArray(dto)) {
      return Left(
        new Error(
          "[ContextModule] HttpTypedDataDescriptorDataSource: Response is not an array",
        ),
      );
    }

    address = address.toLowerCase();
    const primaryTypeHash = getPrimaryTypeHash(schema, primaryType);
    // CAL ignores chain_id when filtering this output, so a descriptor deployed on
    // another chain can still come back
    const descriptor = dto
      .map(
        (item) =>
          item?.descriptors_calldata_eip712?.[address]?.[primaryTypeHash],
      )
      .find((d) => d?.chain_id === chainId);

    if (!descriptor) {
      return Left(
        new Error(
          `[ContextModule] HttpTypedDataDescriptorDataSource: no typed data descriptor for address ${address} on chain ${chainId} for primary type hash ${primaryTypeHash}`,
        ),
      );
    }

    if (!this.isTypedDataDescriptorV1(descriptor, this.config.cal.mode)) {
      return Left(
        new Error(
          `[ContextModule] HttpTypedDataDescriptorDataSource: invalid typed data descriptor for address ${address} on chain ${chainId} for primary type hash ${primaryTypeHash}`,
        ),
      );
    }

    const { data, signatures } = descriptor.message_info.descriptor;
    return Right({
      messageInfo: HexStringUtils.appendSignatureToPayload(
        data,
        signatures[this.config.cal.mode],
        INFO_SIGNATURE_TAG,
      ),
      fields: descriptor.fields.map((field) => field.descriptor),
    });
  }

  private isTypedDataDescriptorV1(
    data: TypedDataDescriptorV1,
    mode: ContextModuleCalMode,
  ): data is TypedDataDescriptorV1 & {
    message_info: {
      descriptor: { signatures: { [_key in ContextModuleCalMode]: string } };
    };
  } {
    return (
      typeof data === "object" &&
      data.type === "eip712" &&
      data.version === "v1" &&
      typeof data.message_info === "object" &&
      typeof data.message_info.descriptor === "object" &&
      typeof data.message_info.descriptor.data === "string" &&
      typeof data.message_info.descriptor.signatures === "object" &&
      typeof data.message_info.descriptor.signatures[mode] === "string" &&
      Array.isArray(data.fields) &&
      data.fields.every((field) => typeof field?.descriptor === "string")
    );
  }
}
