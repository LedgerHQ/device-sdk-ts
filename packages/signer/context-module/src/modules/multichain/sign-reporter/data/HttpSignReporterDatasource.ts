import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
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

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    networkClient?: DmkNetworkClient,
  ) {
    this.http = networkClient ?? networkClientFactory(config);
  }

  async report(params: SignReportParams): Promise<Either<Error, void>> {
    try {
      await this.http.post(
        `${this.config.reporter.url}/v2/blind-signing-events`,
        this.buildDto(params, this.config.appSource),
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

  private buildDto(params: SignReportParams, source: string): SigningEventDto {
    const base = {
      isBlindSign: params.isBlindSign,
      sessionId: params.sessionId ?? null,
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

    switch (params.chain) {
      case "ETH":
        return {
          ...base,
          chain: "ETH",
          chainData: {
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
          },
        };
      case "SOL":
        return {
          ...base,
          chain: "SOL",
          chainData: {
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
          },
        };
    }
  }
}
