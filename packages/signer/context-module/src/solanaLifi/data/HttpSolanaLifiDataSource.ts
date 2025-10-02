import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import {
  GetTransactionDescriptorsParams,
  GetTransactionDescriptorsResponse,
  SolanaLifiDataSource,
} from "./SolanaLifiDataSource";

@injectable()
export class HttpSolanaLifiDataSource implements SolanaLifiDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}
  public async getTransactionDescriptorsPayload({
    templateId,
  }: GetTransactionDescriptorsParams): Promise<
    Either<Error, GetTransactionDescriptorsResponse>
  > {
    try {
      const { data } = await axios.request<GetTransactionDescriptorsResponse[]>(
        {
          method: "GET",
          url: `${this.config.cal.url}/swap_templates`,
          params: {
            template_id: templateId,
            output: "id,chain_id,instructions,descriptors",
            ref: "commit:866b6e7633a7a806fab7f9941bcc3df7ee640784",
          },
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          },
        },
      );

      if (!data || data.length === 0 || !data[0]) {
        return Left(
          new Error(
            `[ContextModule] HttpSolanaLifiDataSource: no transaction descriptors for id ${templateId}`,
          ),
        );
      }

      return Right(data[0]);
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpSolanaLifiDataSource: Failed to fetch transaction descriptors",
        ),
      );
    }
  }
}
