import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { LEDGER_CLIENT_VERSION_HEADER, LEDGER_ORIGIN_TOKEN_HEADER } from "@/shared/constant/HttpHeaders";
import {
  type Web3CheckContext,
  type Web3Checks,
  type Web3CheckTypedDataContext,
} from "@/web3-check/domain/web3CheckTypes";
import PACKAGE from "@root/package.json";

import { Web3CheckDataSource } from "./Web3CheckDataSource";
import { GetWeb3ChecksRequestDto, Web3CheckDto } from "./Web3CheckDto";

@injectable()
export class HttpWeb3CheckDataSource implements Web3CheckDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
  ) {
    if (!this.config.originToken) {
      throw new Error("Origin token is required");
    }
  }

  async getWeb3Checks(
    context: Web3CheckContext,
  ): Promise<Either<Error, Web3Checks>> {
    const { from, deviceModelId } = context;
    let web3CheckDto: Web3CheckDto;
    let requestDto: GetWeb3ChecksRequestDto;
    let url: string;
    if (this.isTypedDataContext(context)) {
      requestDto = {
        msg: {
          from,
          data: context.data,
        },
      };
      url = `${this.config.web3checks.url}/ethereum/scan/eip-712`;
    } else {
      requestDto = {
        tx: {
          from,
          raw: context.rawTx,
        },
        chain: context.chainId,
      };
      url = `${this.config.web3checks.url}/ethereum/scan/tx`;
    }

    try {
      const response = await axios.request<Web3CheckDto>({
        method: "POST",
        url,
        data: requestDto,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });
      web3CheckDto = response.data;
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpWeb3CheckDataSource: Failed to fetch web3 checks informations",
        ),
      );
    }

    if (!this.isWeb3CheckDto(web3CheckDto)) {
      return Left(
        new Error(
          "[ContextModule] HttpWeb3CheckDataSource: Cannot exploit Web3 checks data received",
        ),
      );
    }

    const certificate = await this._certificateLoader.loadCertificate({
      keyId: web3CheckDto.public_key_id,
      keyUsage: KeyUsage.TxSimulationSigner,
      targetDevice: deviceModelId,
    });

    const result: Web3Checks = {
      publicKeyId: web3CheckDto.public_key_id,
      descriptor: web3CheckDto.descriptor,
      certificate,
    };

    return Right(result);
  }

  private isTypedDataContext(
    context: Web3CheckContext,
  ): context is Web3CheckTypedDataContext {
    return "data" in context;
  }

  private isWeb3CheckDto(dto: unknown): dto is Web3CheckDto {
    return (
      dto != null &&
      typeof dto == "object" &&
      "public_key_id" in dto &&
      dto.public_key_id != null &&
      typeof dto.public_key_id == "string" &&
      "descriptor" in dto &&
      dto.descriptor != null &&
      typeof dto.descriptor == "string"
    );
  }
}
