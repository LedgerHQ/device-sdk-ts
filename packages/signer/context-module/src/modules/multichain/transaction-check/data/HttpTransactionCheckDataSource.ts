import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import { TransactionCheckResponseDto } from "./dto/TransactionCheckResponseDto";
import {
  TransactionCheckDataSource,
  TransactionCheckParams,
  TransactionCheckResult,
} from "./TransactionCheckDataSource";

@injectable()
export class HttpTransactionCheckDataSource
  implements TransactionCheckDataSource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async check({
    path,
    body,
  }: TransactionCheckParams): Promise<Either<Error, TransactionCheckResult>> {
    let dto: TransactionCheckResponseDto;
    try {
      dto = (await this.http.post(
        `${this.config.web3checks.url}${path}`,
        body,
      )) as TransactionCheckResponseDto;
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTransactionCheckDataSource: Failed to fetch web3 check",
        ),
      );
    }

    if (!this._isDto(dto)) {
      return Left(
        new Error(
          "[ContextModule] HttpTransactionCheckDataSource: Invalid web3 check response",
        ),
      );
    }

    return Right({
      publicKeyId: dto.public_key_id,
      descriptor: dto.descriptor,
    });
  }

  private _isDto(dto: unknown): dto is TransactionCheckResponseDto {
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
