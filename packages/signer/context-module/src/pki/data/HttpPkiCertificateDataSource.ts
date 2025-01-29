import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { PkiCertificate } from "@/pki/model/PkiCertificate";
import { PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";
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
      const pkiCertificateResponse = await axios.request<
        PkiCertificateResponseDto[]
      >({
        method: "GET",
        url: `${this.config.cal.url}/certificates`,
        params: requestDto,
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      if (
        pkiCertificateResponse.status == 200 &&
        pkiCertificateResponse.data !== undefined &&
        pkiCertificateResponse.data.length > 0
      ) {
        const payload = hexaStringToBuffer(
          HexStringUtils.appendSignatureToPayload(
            pkiCertificateResponse.data[0]!.descriptor.data,
            pkiCertificateResponse.data[0]!.descriptor.signatures[
              this.config.cal.mode
            ],
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
}
