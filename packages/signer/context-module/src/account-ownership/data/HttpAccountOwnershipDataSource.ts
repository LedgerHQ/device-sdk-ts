import axios from "axios";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import {
  type AccountOwnershipDataSource,
  type AccountOwnershipDescriptor,
  type GetAccountOwnershipParams,
} from "@/account-ownership/data/AccountOwnershipDataSource";
import { type AccountOwnershipDto } from "@/account-ownership/data/dto/AccountOwnershipDto";
import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

@injectable()
export class HttpAccountOwnershipDataSource
  implements AccountOwnershipDataSource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
  ) {}

  async getDescriptor({
    publicKey,
    address,
    challenge,
    network,
  }: GetAccountOwnershipParams): Promise<
    Either<Error, AccountOwnershipDescriptor>
  > {
    try {
      const response = await axios.request<AccountOwnershipDto>({
        method: "GET",
        url: `${this.config.metadataServiceDomain.url}/v2/concordium/owner/${publicKey}/${address}`,
        params: {
          challenge,
          network,
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });

      if (!response.data) {
        return Left(
          new Error(
            "[ContextModule] HttpAccountOwnershipDataSource: unexpected empty response",
          ),
        );
      }

      if (!this.isAccountOwnershipDto(response.data)) {
        return Left(
          new Error(
            "[ContextModule] HttpAccountOwnershipDataSource: invalid response format",
          ),
        );
      }

      return Right({
        signedDescriptor: response.data.signedDescriptor,
        keyId: response.data.keyId,
        keyUsage: response.data.keyUsage,
      });
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpAccountOwnershipDataSource: Failed to fetch account ownership descriptor",
        ),
      );
    }
  }

  private isAccountOwnershipDto(value: unknown): value is AccountOwnershipDto {
    return (
      typeof value === "object" &&
      value !== null &&
      "signedDescriptor" in value &&
      "keyId" in value &&
      "keyUsage" in value &&
      typeof value.signedDescriptor === "string" &&
      typeof value.keyId === "string" &&
      typeof value.keyUsage === "string"
    );
  }
}
