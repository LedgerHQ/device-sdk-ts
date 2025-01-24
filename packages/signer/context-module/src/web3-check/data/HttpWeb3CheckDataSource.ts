import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  type Web3CheckContext,
  type Web3Checks,
} from "@/web3-check/domain/web3CheckTypes";
import PACKAGE from "@root/package.json";

import { Web3CheckDataSource } from "./Web3CheckDataSource";
import { GetWeb3ChecksRequestDto, Web3CheckDto } from "./Web3CheckDto";

@injectable()
export class HttpWeb3CheckDataSource implements Web3CheckDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  async getWeb3Checks(
    params: Web3CheckContext,
  ): Promise<Either<Error, Web3Checks>> {
    let web3CheckDto: Web3CheckDto;

    try {
      const requestDto: GetWeb3ChecksRequestDto = {
        tx: {
          from: params.from,
          raw: params.rawTx,
        },
        chain: params.chainId,
      };
      const response = await axios.request<Web3CheckDto>({
        method: "POST",
        url: `${this.config.cal.web3checksUrl}`,
        data: requestDto,
        headers: {
          "x-api-key": "oo9TP3XqBSAQ5JNDN6VWdUCtGdtI4bx0",
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      web3CheckDto = response.data;
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpWeb3CheckDataSource: Failed to fetch web3 checks informations",
        ),
      );
    }

    if (!this.isWeb3CheckDto(web3CheckDto)) {
      return Left(
        new Error(
          "[ContextModule] HttpWeb3CheckDataSource: Cannot exploit Web3 checks data received",
        ),
      );
    }

    const result: Web3Checks = {
      publicKeyId: web3CheckDto.public_key_id,
      descriptor: web3CheckDto.descriptor,
    };

    return Right(result);
  }

  private isWeb3CheckDto(dto: unknown): dto is Web3CheckDto {
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
