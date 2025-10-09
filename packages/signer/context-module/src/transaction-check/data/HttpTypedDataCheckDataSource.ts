import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { TypedDataCheckDto } from "./dto/TypedDataCheckDto";
import {
  GetTypedDataCheckParams,
  TypedDataCheck,
  TypedDataCheckDataSource,
} from "./TypedDataCheckDataSource";

@injectable()
export class HttpTypedDataCheckDataSource implements TypedDataCheckDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
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
      const response = await axios.request<TypedDataCheckDto>({
        method: "POST",
        url: `${this.config.web3checks.url}/ethereum/scan/eip-712`,
        data: requestDto,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });
      typedDataCheckDto = response.data;
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
