import {
  DmkNetworkClient,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  GetTransactionDescriptorsParams,
  GetTransactionDescriptorsResponse,
  LifiDataSource,
} from "./LifiDataSource";

@injectable()
export class HttpLifiDataSource implements LifiDataSource {
  private logger: LoggerPublisherService;

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {
    this.logger = loggerFactory("HttpLifiDataSource");
  }

  public async getTransactionDescriptorsPayload({
    templateId,
  }: GetTransactionDescriptorsParams): Promise<
    Either<Error, GetTransactionDescriptorsResponse>
  > {
    this.logger.debug(
      "[getTransactionDescriptorsPayload] Fetching transaction descriptors",
      {
        data: { templateId },
      },
    );

    try {
      const data = (await this.http.get(
        `${this.config.cal.url}/swap_templates`,
        {
          params: {
            template_id: templateId,
            output: "id,chain_id,instructions,descriptors",
            // TODO LIFI
            // REVERT WHEN CAL SUPPORTS IT
            ref: "ref=commit:866b6e7633a7a806fab7f9941bcc3df7ee640784",
          },
        },
      )) as GetTransactionDescriptorsResponse[];

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
            `[ContextModule] HttpLifiDataSource: no transaction descriptors for id ${templateId}`,
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
            error: error instanceof Error ? error.message : String(error),
          },
        },
      );
      return Left(
        new Error(
          "[ContextModule] HttpLifiDataSource: Failed to fetch transaction descriptors",
        ),
      );
    }
  }
}
