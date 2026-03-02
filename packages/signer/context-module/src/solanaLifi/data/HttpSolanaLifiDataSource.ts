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
      const url = new URL(`${this.config.cal.url}/swap_templates`);
      url.searchParams.set("template_id", templateId);
      url.searchParams.set("output", "id,chain_id,instructions,descriptors");
      // TODO LIFI
      // REVERT WHEN CAL SUPPORTS IT
      url.searchParams.set(
        "ref",
        "ref=commit:866b6e7633a7a806fab7f9941bcc3df7ee640784",
      );
      const response = await fetch(url, {
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data =
        (await response.json()) as GetTransactionDescriptorsResponse[];

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
