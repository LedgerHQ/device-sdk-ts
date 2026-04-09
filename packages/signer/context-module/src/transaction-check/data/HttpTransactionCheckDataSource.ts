import axios from "axios";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import { dispatchTransactionCheckScanHandler } from "@/transaction-check/scan-handlers/transactionCheckScanHandlerRegistry";
import { type Web3ChecksScanRequestBody } from "@/transaction-check/scan-handlers/transactionCheckScanTypes";
import {
  WEB3CHECKS_ETHEREUM_TX_SCAN_PATH,
  WEB3CHECKS_SOLANA_TX_SCAN_PATH,
} from "@/transaction-check/scan-handlers/web3CheckScanPaths";
import PACKAGE from "@root/package.json";

import { TransactionCheckDto } from "./dto/TransactionCheckDto";
import {
  type GetTransactionCheckParams,
  type TransactionCheck,
} from "./TransactionCheckDataSource";

export { WEB3CHECKS_ETHEREUM_TX_SCAN_PATH, WEB3CHECKS_SOLANA_TX_SCAN_PATH };

@injectable()
export class HttpTransactionCheckDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
  ) {}

  public async getTransactionCheck(
    params: GetTransactionCheckParams,
  ): Promise<Either<Error, TransactionCheck>> {
    return dispatchTransactionCheckScanHandler(params, (urlPath, data) =>
      this._postScan(urlPath, data),
    );
  }

  private _web3ChecksHeaders(): Record<string, string> {
    return {
      [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
      [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
    };
  }

  private async _postScan(
    urlPath: string,
    data: Web3ChecksScanRequestBody,
  ): Promise<Either<Error, TransactionCheck>> {
    let transactionCheckDto: TransactionCheckDto;
    try {
      const response = await axios.request<TransactionCheckDto>({
        method: "POST",
        url: `${this.config.web3checks.url}${urlPath}`,
        data,
        headers: this._web3ChecksHeaders(),
      });
      transactionCheckDto = response.data;
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTransactionCheckDataSource: Failed to fetch web3 checks information",
        ),
      );
    }

    if (!this._isTransactionCheckDto(transactionCheckDto)) {
      return Left(
        new Error(
          "[ContextModule] HttpTransactionCheckDataSource: Cannot exploit transaction check data received",
        ),
      );
    }
    const result: TransactionCheck = {
      publicKeyId: transactionCheckDto.public_key_id,
      descriptor: transactionCheckDto.descriptor,
    };

    return Right(result);
  }

  private _isTransactionCheckDto(dto: unknown): dto is TransactionCheckDto {
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
