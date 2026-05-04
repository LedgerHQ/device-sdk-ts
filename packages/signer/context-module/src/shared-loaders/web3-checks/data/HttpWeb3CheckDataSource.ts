import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { networkTypes } from "@/chain-agnostic-loaders/network/di/networkTypes";
import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { Web3CheckResponseDto } from "./dto/Web3CheckResponseDto";
import {
  Web3CheckDataSource,
  Web3CheckParams,
  Web3CheckResult,
} from "./Web3CheckDataSource";

@injectable()
export class HttpWeb3CheckDataSource implements Web3CheckDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async check({
    path,
    body,
  }: Web3CheckParams): Promise<Either<Error, Web3CheckResult>> {
    let dto: Web3CheckResponseDto;
    try {
      dto = (await this.http.post(
        `${this.config.web3checks.url}${path}`,
        body,
      )) as Web3CheckResponseDto;
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpWeb3CheckDataSource: Failed to fetch web3 check",
        ),
      );
    }

    if (!this._isDto(dto)) {
      return Left(
        new Error(
          "[ContextModule] HttpWeb3CheckDataSource: Invalid web3 check response",
        ),
      );
    }

    return Right({
      publicKeyId: dto.public_key_id,
      descriptor: dto.descriptor,
    });
  }

  private _isDto(dto: unknown): dto is Web3CheckResponseDto {
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
