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
import { PkiCertificate } from "@/pki/model/PkiCertificate";
import { PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import { SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";
import { KeyUsageMapper } from "@/shared/utils/KeyUsageMapper";
import PACKAGE from "@root/package.json";

import { type PkiCertificateDataSource } from "./PkiCertificateDataSource";
import {
  type PkiCertificateRequestDto,
  type PkiCertificateResponseDto,
} from "./pkiDataSourceTypes";

@injectable()
export class HttpPkiCertificateDataSource implements PkiCertificateDataSource {
  private readonly http: DmkNetworkClient;

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
  ) {
    this.http = new DmkNetworkClient({
      headers: {
        [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
      },
    });
  }

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
    if (
      typeof value !== "object" ||
      value === null ||
      !("descriptor" in value) ||
      typeof value.descriptor !== "object" ||
      value.descriptor === null
    ) {
      return false;
    }
    const { descriptor } = value;
    if (
      !("data" in descriptor) ||
      typeof descriptor.data !== "string" ||
      !("signatures" in descriptor) ||
      typeof descriptor.signatures !== "object" ||
      descriptor.signatures === null ||
      !(mode in descriptor.signatures)
    ) {
      return false;
    }
    const signature = (descriptor.signatures as Record<string, unknown>)[mode];
    return typeof signature === "string";
  }
}
