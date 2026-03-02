import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type {
  ContextModuleCalMode,
  ContextModuleConfig,
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
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
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
      const url = new URL(`${this.config.cal.url}/certificates`);
      url.searchParams.set("output", requestDto.output);
      url.searchParams.set("target_device", requestDto.target_device);
      url.searchParams.set("latest", String(requestDto.latest));
      url.searchParams.set("public_key_id", String(requestDto.public_key_id));
      url.searchParams.set("public_key_usage", requestDto.public_key_usage);
      const response = await fetch(url, {
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = (await response.json()) as PkiCertificateResponseDto[];

      if (
        data !== undefined &&
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
    return (
      typeof value === "object" &&
      value !== null &&
      "descriptor" in value &&
      typeof value.descriptor === "object" &&
      value.descriptor !== null &&
      "data" in value.descriptor &&
      typeof value.descriptor.data === "string" &&
      "signatures" in value.descriptor &&
      typeof value.descriptor.signatures === "object" &&
      value.descriptor.signatures !== null &&
      mode in value.descriptor.signatures &&
      typeof (value.descriptor.signatures as Record<string, unknown>)[mode] ===
        "string"
    );
  }
}
