import { base64StringToBuffer } from "@ledgerhq/device-management-kit";
import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import {
  SolanaSPLOwnerInfo,
  type SolanaTransactionContext,
} from "@/solana/domain/solanaContextTypes";
import PACKAGE from "@root/package.json";

import {
  HttpSolanaDataSourceResult,
  SolanaDataSource,
} from "./SolanaDataSource";

@injectable()
export class HttpSolanaDataSource implements SolanaDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {
    if (!this.config.originToken) {
      throw new Error(
        "[ContextModule] - HttpSolanaDataSource: origin token is required",
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
        url: `${this.config.web3checks.url}/solana/owner/${tokenAddress}?challenge=${challenge}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          "X-Ledger-Client-Origin": this.config.originToken,
        },
      })
      .then((res) => {
        if (!this.isSolanaSPLOwnerInfo(res.data))
          return Left(
            new Error(
              "[ContextModule] - HttpSolanaDataSource: invalid fetchAddressMetadata response shape",
            ),
          );
        return Right(res.data);
      })
      .catch(() =>
        Left(
          new Error(
            "[ContextModule] - HttpSolanaDataSource: Failed to fetch address metadata",
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
        url: `${this.config.web3checks.url}/solana/computed-token-account/${address}/${mintAddress}?challenge=${challenge}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          "X-Ledger-Client-Origin": this.config.originToken,
        },
      })
      .then((res) => {
        if (!this.isSolanaSPLOwnerInfo(res.data))
          return Left(
            new Error(
              "[ContextModule] - HttpSolanaDataSource: invalid computeAddressMetadata response shape",
            ),
          );
        return Right(res.data);
      })
      .catch(() =>
        Left(
          new Error(
            "[ContextModule] - HttpSolanaDataSource: Failed to compute address metadata",
          ),
        ),
      );
  }

  async getSolanaContext(
    context: SolanaTransactionContext,
  ): Promise<Either<Error, HttpSolanaDataSourceResult>> {
    const { tokenAddress, challenge, createATA } = context;

    if (!challenge) {
      return Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: challenge is required",
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
          "[ContextModule] - HttpSolanaDataSource: either tokenAddress or valid createATA must be provided",
        ),
      );
    }

    return ownerInfoResult.chain((ownerInfo) => {
      const descriptor = base64StringToBuffer(ownerInfo.signedDescriptor);
      if (!descriptor) {
        return Left(
          new Error(
            "[ContextModule] - HttpSolanaDataSource: invalid base64 descriptor received",
          ),
        );
      }
      return Right({
        descriptor,
        tokenAccount: ownerInfo.tokenAccount,
        owner: ownerInfo.owner,
        contract: ownerInfo.contract,
      });
    });
  }
}
