import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/network/di/networkTypes";

import { TransactionCheckDto } from "./dto/TransactionCheckDto";
import {
  GetTransactionCheckParams,
  TransactionCheck,
} from "./TransactionCheckDataSource";

@injectable()
export class HttpTransactionCheckDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getTransactionCheck({
    chainId,
    rawTx,
    from,
  }: GetTransactionCheckParams): Promise<Either<Error, TransactionCheck>> {
    let transactionCheckDto: TransactionCheckDto;
    const requestDto = {
      tx: {
        from,
        raw: rawTx,
      },
      chain: chainId,
    };

    try {
      transactionCheckDto = (await this.http.post(
        `${this.config.web3checks.url}/ethereum/scan/tx`,
        requestDto,
      )) as TransactionCheckDto;
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
