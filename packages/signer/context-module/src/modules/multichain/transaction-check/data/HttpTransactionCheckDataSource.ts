import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

//import { configTypes } from "@/config/di/configTypes";
//import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import { TransactionCheckResponseDto } from "./dto/TransactionCheckResponseDto";
import {
  TransactionCheckDataSource,
  TransactionCheckParams,
  TransactionCheckResult,
} from "./TransactionCheckDataSource";

// TODO(test): temporary hardcoded web3-checks test backend base URL for Solana
// only (see check()). Revert before merge.
const WEB3CHECKS_TEST_BASE_URL =
  "https://web3checks-backend.api.ledger-test.com/v3";

// TODO(test): force the scan provider via X-Ledger-Forced-Provider
// ("blockaid" | "cyvers"). Remove before merge.
const FORCED_PROVIDER_HEADER = "X-Ledger-Forced-Provider";
const FORCED_PROVIDER = "blockaid";

@injectable()
export class HttpTransactionCheckDataSource
  implements TransactionCheckDataSource
{
  constructor(
    //@inject(configTypes.Config)
    //private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async check({
    path,
    body,
  }: TransactionCheckParams): Promise<Either<Error, TransactionCheckResult>> {
    //this.config.web3checks.url;
    let dto: TransactionCheckResponseDto;
    try {
      dto = (await this.http.post(`${WEB3CHECKS_TEST_BASE_URL}${path}`, body, {
        headers: { [FORCED_PROVIDER_HEADER]: FORCED_PROVIDER },
      })) as TransactionCheckResponseDto;
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
