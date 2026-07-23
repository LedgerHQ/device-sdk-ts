import {
  DmkNetworkClient,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  type SolanaSPLOwnerInfo,
  type SolanaTransactionContext,
} from "@/modules/solana/model/SolanaTransactionContext";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  HttpOwnerInfoDataSourceResult,
  OwnerInfoDataSource,
} from "./OwnerInfoDataSource";

@injectable()
export class HttpOwnerInfoDataSource implements OwnerInfoDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

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
    try {
      const data = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v2/solana/owner/${tokenAddress}`,
        { params: { challenge } },
      )) as SolanaSPLOwnerInfo;
      if (!this.isSolanaSPLOwnerInfo(data))
        return Left(
          new Error(
            "[ContextModule] - HttpOwnerInfoDataSource: invalid fetchAddressMetadata response shape",
          ),
        );
      return Right(data);
    } catch {
      return Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: Failed to fetch address metadata",
        ),
      );
    }
  }

  async computeAddressMetadata(
    address: string,
    mintAddress: string,
    challenge: string,
  ): Promise<Either<Error, SolanaSPLOwnerInfo>> {
    try {
      const data = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v2/solana/computed-token-account/${address}/${mintAddress}`,
        { params: { challenge } },
      )) as SolanaSPLOwnerInfo;
      if (!this.isSolanaSPLOwnerInfo(data))
        return Left(
          new Error(
            "[ContextModule] - HttpOwnerInfoDataSource: invalid computeAddressMetadata response shape",
          ),
        );
      return Right(data);
    } catch {
      return Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: Failed to compute address metadata",
        ),
      );
    }
  }

  async getOwnerInfo(
    context: SolanaTransactionContext,
  ): Promise<Either<Error, HttpOwnerInfoDataSourceResult>> {
    const { tokenAddress, challenge, createATA } = context;

    if (!challenge) {
      return Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: challenge is required",
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
          "[ContextModule] - HttpOwnerInfoDataSource: either tokenAddress or valid createATA must be provided",
        ),
      );
    }

    return ownerInfoResult.chain((ownerInfo) => {
      const tlvDescriptor = hexaStringToBuffer(ownerInfo.signedDescriptor);
      if (!tlvDescriptor) {
        return Left(
          new Error(
            "[ContextModule] - HttpOwnerInfoDataSource: invalid base64 tlvDescriptor received",
          ),
        );
      }
      return Right({
        tlvDescriptor,
      });
    });
  }
}
