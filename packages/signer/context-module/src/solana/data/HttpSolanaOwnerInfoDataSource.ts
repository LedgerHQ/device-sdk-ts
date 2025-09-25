import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import {
  SolanaSPLOwnerInfo,
  type SolanaTransactionContext,
} from "@/solana/domain/solanaContextTypes";
import PACKAGE from "@root/package.json";

import {
  HttpSolanaOwnerInfoDataSourceResult,
  SolanaDataSource,
} from "./SolanaDataSource";

@injectable()
export class HttpSolanaOwnerInfoDataSource implements SolanaDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {
    if (!this.config.originToken) {
      throw new Error(
        "[ContextModule] - HttpSolanaOwnerInfoDataSource: origin token is required",
      );
    }
  }

  private isSolanaSPLOwnerInfo(data: {
    tokenAccount?: unknown;
    owner?: unknown;
    contract?: unknown;
    signedDescriptor?: unknown;
  }): data is SolanaSPLOwnerInfo {
    if (typeof data !== "object" || data === null) return false;
    return (
      typeof data.tokenAccount === "string" &&
      typeof data.owner === "string" &&
      typeof data.contract === "string" &&
      typeof data.signedDescriptor === "string"
    );
  }

  async fetchAddressMetadata(
    tokenAddress: string,
    challenge: string,
  ): Promise<Either<Error, SolanaSPLOwnerInfo>> {
    return await axios
      .request<SolanaSPLOwnerInfo>({
        method: "GET",
        url: `${this.config.metadataServiceDomain.url}/v2/solana/owner/${tokenAddress}?challenge=${challenge}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      })
      .then((res) => {
        if (!this.isSolanaSPLOwnerInfo(res.data))
          return Left(
            new Error(
              "[ContextModule] - HttpSolanaOwnerInfoDataSource: invalid fetchAddressMetadata response shape",
            ),
          );
        return Right(res.data);
      })
      .catch(() =>
        Left(
          new Error(
            "[ContextModule] - HttpSolanaOwnerInfoDataSource: Failed to fetch address metadata",
          ),
        ),
      );
  }

  async computeAddressMetadata(
    address: string,
    mintAddress: string,
    challenge: string,
  ): Promise<Either<Error, SolanaSPLOwnerInfo>> {
    return await axios
      .request<SolanaSPLOwnerInfo>({
        method: "GET",
        url: `${this.config.metadataServiceDomain.url}/v2/solana/computed-token-account/${address}/${mintAddress}?challenge=${challenge}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          "X-Ledger-Client-Origin": this.config.originToken,
        },
      })
      .then((res) => {
        if (!this.isSolanaSPLOwnerInfo(res.data))
          return Left(
            new Error(
              "[ContextModule] - HttpSolanaOwnerInfoDataSource: invalid computeAddressMetadata response shape",
            ),
          );
        return Right(res.data);
      })
      .catch(() =>
        Left(
          new Error(
            "[ContextModule] - HttpSolanaOwnerInfoDataSource: Failed to compute address metadata",
          ),
        ),
      );
  }

  async getOwnerInfo(
    context: SolanaTransactionContext,
  ): Promise<Either<Error, HttpSolanaOwnerInfoDataSourceResult>> {
    const { tokenAddress, challenge, createATA } = context;

    if (!challenge) {
      return Left(
        new Error(
          "[ContextModule] - HttpSolanaOwnerInfoDataSource: challenge is required",
        ),
      );
    }

    let ownerInfoResult: Either<Error, SolanaSPLOwnerInfo>;

    if (tokenAddress) {
      ownerInfoResult = await this.fetchAddressMetadata(
        tokenAddress,
        challenge,
      );
    } else if (createATA?.address && createATA?.mintAddress) {
      ownerInfoResult = await this.computeAddressMetadata(
        createATA.address,
        createATA.mintAddress,
        challenge,
      );
    } else {
      return Left(
        new Error(
          "[ContextModule] - HttpSolanaOwnerInfoDataSource: either tokenAddress or valid createATA must be provided",
        ),
      );
    }

    return ownerInfoResult.chain((ownerInfo) => {
      const tlvDescriptor = hexaStringToBuffer(ownerInfo.signedDescriptor);
      if (!tlvDescriptor) {
        return Left(
          new Error(
            "[ContextModule] - HttpSolanaOwnerInfoDataSource: invalid base64 tlvDescriptor received",
          ),
        );
      }
      return Right({
        tlvDescriptor,
      });
    });
  }
}
