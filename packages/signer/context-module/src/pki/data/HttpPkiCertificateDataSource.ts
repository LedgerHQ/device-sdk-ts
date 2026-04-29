import {
  DmkNetworkClient,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type {
  ContextModuleCalMode,
  ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/network/di/networkTypes";
import { PkiCertificate } from "@/pki/model/PkiCertificate";
import { PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";
import { SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";
import { KeyUsageMapper } from "@/shared/utils/KeyUsageMapper";

import { type PkiCertificateDataSource } from "./PkiCertificateDataSource";
import {
  type PkiCertificateRequestDto,
  type PkiCertificateResponseDto,
} from "./pkiDataSourceTypes";

@injectable()
export class HttpPkiCertificateDataSource implements PkiCertificateDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  async fetchCertificate(
    pkiCertificateInfo: PkiCertificateInfo,
  ): Promise<Either<Error, PkiCertificate | undefined>> {
    const requestDto: PkiCertificateRequestDto = {
      output: "descriptor",
      target_device: pkiCertificateInfo.targetDevice,
      latest: true,
      public_key_id: pkiCertificateInfo.keyId,
      public_key_usage: pkiCertificateInfo.keyUsage,
    };

    try {
      const data = await this.http.get(`${this.config.cal.url}/certificates`, {
        params: {
          output: requestDto.output,
          target_device: requestDto.target_device,
          latest: requestDto.latest,
          public_key_id: requestDto.public_key_id,
          public_key_usage: requestDto.public_key_usage,
        },
      });

      if (
        Array.isArray(data) &&
        data.length > 0 &&
        this.isValidPkiCertificateResponse(data[0], this.config.cal.mode)
      ) {
        const payload = hexaStringToBuffer(
          HexStringUtils.appendSignatureToPayload(
            data[0].descriptor.data,
            data[0].descriptor.signatures[this.config.cal.mode],
            SIGNATURE_TAG,
          ),
        );
        if (!payload) {
          return Left(
            Error(
              "[ContextModule] HttpPkiCertificateDataSource: Cannot generate payload from fetched PKI Certificate",
            ),
          );
        }
        const pkiCertificate: PkiCertificate = {
          payload: payload,
          keyUsageNumber: KeyUsageMapper.mapKeyUsageForFirmware(
            pkiCertificateInfo.keyUsage,
          ),
        };
        return Right(pkiCertificate);
      } else {
        return Left(
          Error(
            "[ContextModule] HttpPkiCertificateDataSource: failed to fetch PKI for given descriptor",
          ),
        );
      }
    } catch (_error) {
      return Left(
        Error(
          "[ContextModule] HttpPkiCertificateDataSource: failed to fetch PKI for given descriptor",
        ),
      );
    }
  }

  private isValidPkiCertificateResponse(
    value: unknown,
    mode: ContextModuleCalMode,
  ): value is PkiCertificateResponseDto {
    if (!this.isRecord(value) || !this.isRecord(value["descriptor"])) {
      return false;
    }
    const descriptor = value["descriptor"];
    if (
      typeof descriptor["data"] !== "string" ||
      !this.isRecord(descriptor["signatures"])
    ) {
      return false;
    }
    return typeof descriptor["signatures"][mode] === "string";
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
