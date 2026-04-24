import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/network/di/networkTypes";

import { TypedDataCheckDto } from "./dto/TypedDataCheckDto";
import {
  GetTypedDataCheckParams,
  TypedDataCheck,
  TypedDataCheckDataSource,
} from "./TypedDataCheckDataSource";

@injectable()
export class HttpTypedDataCheckDataSource implements TypedDataCheckDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getTypedDataCheck({
    from,
    data,
  }: GetTypedDataCheckParams): Promise<Either<Error, TypedDataCheck>> {
    let typedDataCheckDto: TypedDataCheckDto;
    const requestDto = {
      msg: {
        from,
        data,
      },
    };

    try {
      typedDataCheckDto = (await this.http.post(
        `${this.config.web3checks.url}/ethereum/scan/eip-712`,
        requestDto,
      )) as TypedDataCheckDto;
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTypedDataCheckDataSource: Failed to fetch typed data check information",
        ),
      );
    }

    if (!this._isTypedDataCheckDto(typedDataCheckDto)) {
      return Left(
        new Error(
          "[ContextModule] HttpTypedDataCheckDataSource: Cannot exploit typed data check data received",
        ),
      );
    }

    const result: TypedDataCheck = {
      publicKeyId: typedDataCheckDto.public_key_id,
      descriptor: typedDataCheckDto.descriptor,
    };

    return Right(result);
  }

  private _isTypedDataCheckDto(dto: unknown): dto is TypedDataCheckDto {
    return (
      dto != null &&
      typeof dto == "object" &&
      "public_key_id" in dto &&
      dto.public_key_id != null &&
      typeof dto.public_key_id == "string" &&
      "descriptor" in dto &&
      dto.descriptor != null &&
      typeof dto.descriptor == "string"
    );
  }
}
