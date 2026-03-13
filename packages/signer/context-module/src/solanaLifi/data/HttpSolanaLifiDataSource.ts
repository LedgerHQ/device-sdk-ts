import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
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
  private logger: LoggerPublisherService;

  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("HttpSolanaLifiDataSource");
  }

  public async getTransactionDescriptorsPayload({
    templateId,
  }: GetTransactionDescriptorsParams): Promise<
    Either<Error, GetTransactionDescriptorsResponse>
  > {
    const url = `${this.config.cal.url}/swap_templates`;
    const params = {
      id: templateId,
      output: "id,chain_id,instructions,descriptors",
    };

    this.logger.debug(
      "[getTransactionDescriptorsPayload] Fetching transaction descriptors",
      {
        data: { templateId, url, params },
      },
    );

    try {
      const { data } = await axios.request<GetTransactionDescriptorsResponse[]>(
        {
          method: "GET",
          url,
          params,
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          },
        },
      );

      this.logger.debug(
        "[getTransactionDescriptorsPayload] Received response",
        {
          data: {
            templateId,
            responseLength: data?.length ?? 0,
            hasData: !!data && data.length > 0,
          },
        },
      );

      if (!data || data.length === 0 || !data[0]) {
        this.logger.warn(
          "[getTransactionDescriptorsPayload] No transaction descriptors found",
          {
            data: { templateId, responseLength: data?.length ?? 0 },
          },
        );
        return Left(
          new Error(
            `[ContextModule] HttpSolanaLifiDataSource: no transaction descriptors for id ${templateId}`,
          ),
        );
      }

      this.logger.info(
        "[getTransactionDescriptorsPayload] Successfully fetched transaction descriptors",
        {
          data: {
            templateId,
            descriptorsCount: data[0].descriptors?.length ?? 0,
          },
        },
      );

      return Right(data[0]);
    } catch (error) {
      this.logger.error(
        "[getTransactionDescriptorsPayload] Failed to fetch transaction descriptors",
        {
          data: {
            templateId,
            url,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      );
      return Left(
        new Error(
          "[ContextModule] HttpSolanaLifiDataSource: Failed to fetch transaction descriptors",
        ),
      );
    }
  }
}
