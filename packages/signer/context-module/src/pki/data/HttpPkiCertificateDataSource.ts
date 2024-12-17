import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  PkiCertificate,
  PkiCertificateInfo,
} from "@/pki/domain/pkiCertificateTypes";
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
      output:
        "id,target_device,not_valid_after,public_key_usage,certificate_version,descriptor",
      target_device: "nanox", //TODO add in input
      not_valid_after: "1.3.0", //TODO add current OS_version
      latest: true,
      descriptor: pkiCertificateInfo.descriptor,
    };

    try {
      const pkiCertificateResponse =
        await axios.request<PkiCertificateResponseDto>({
          method: "GET",
          url: `${this.config.cal.url}/certificates`,
          params: requestDto,
          headers: {
            "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
          },
        });

      if (pkiCertificateResponse.status == 200) {
        return Right(pkiCertificateResponse.data);
      } else {
        return Left(
          Error(
            "HTTP Error encountered: Cannot fetch PKI for given descriptor",
          ),
        );
      }
    } catch (_error) {
      return Left(
        Error(
          "Exception occured during axios request for fetching PKI Certificates",
        ),
      );
    }
  }
}
