import {
  type DmkNetworkClient,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type SignReportParams } from "@/modules/multichain/sign-reporter/model/SignReportParams";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { networkClientFactory } from "@/shared/network/networkClientFactory";

import { type SigningEventDto } from "./dto/SigningEventDto";
import { type SignReporterDatasource } from "./SignReporterDatasource";

@injectable()
export class HttpSignReporterDatasource implements SignReporterDatasource {
  private readonly http: DmkNetworkClient;
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(networkTypes.NetworkClient)
    networkClient?: DmkNetworkClient,
  ) {
    this.http = networkClient ?? networkClientFactory(config);
    this.logger = loggerFactory("HttpSignReporterDatasource");
  }

  async report(params: SignReportParams): Promise<Either<Error, void>> {
    try {
      const dto = this.buildDto(params, this.config.appSource);
      this.logger.debug("[report] Posting signing event", { data: dto });
      await this.http.post(
        `${this.config.reporter.url}/v2/blind-signing-events`,
        dto,
        { responseType: "void" },
      );
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpSignReporterDatasource: Failed to report signing event",
        ),
      );
    }

    return Right(undefined);
  }

  private buildChainData(
    params: SignReportParams,
  ): SigningEventDto["chainData"] {
    switch (params.chain) {
      case "SOL":
        return {
          chain: "SOL",
          signatureId: params.signatureId,
          signingMethod: params.signingMethod,
          targetAddress: params.targetAddress,
          blindSignReason: params.blindSignReason,
          programIds: params.programIds,
          unrecognizedPrograms: params.unrecognizedPrograms,
          ...(params.transactionSignature !== undefined && {
            transactionSignature: params.transactionSignature,
          }),
        };
      case "ETH":
        return {
          chain: "ETH",
          signatureId: params.signatureId,
          signingMethod: params.signingMethod,
          targetAddress: params.targetAddress,
          chainId: params.chainId,
          blindSignReason: params.blindSignReason,
          ...(params.selectorId !== undefined && {
            selectorId: params.selectorId,
          }),
          ...(params.clearSigningType !== undefined && {
            clearSigningType: params.clearSigningType,
          }),
          ...(params.partialContextErrors !== undefined && {
            partialContextErrors: params.partialContextErrors,
          }),
        };
    }
  }

  private buildDto(params: SignReportParams, source: string): SigningEventDto {
    return {
      chain: params.chain,
      isBlindSign: params.isBlindSign,
      sessionId: params.sessionId ?? null,
      chainData: this.buildChainData(params),
      envData: {
        modelId: params.modelId,
        signerAppVersion: params.signerAppVersion,
        deviceVersion: params.deviceVersion,
        source,
        ...(params.platform !== undefined && { platform: params.platform }),
        ...(params.appVersion !== undefined && {
          appVersion: params.appVersion,
        }),
        ...(params.platformOS !== undefined && {
          platformOS: params.platformOS,
        }),
        ...(params.platformVersion !== undefined && {
          platformVersion: params.platformVersion,
        }),
        ...(params.liveAppContext !== undefined && {
          liveAppContext: params.liveAppContext,
        }),
      },
    };
  }
}
