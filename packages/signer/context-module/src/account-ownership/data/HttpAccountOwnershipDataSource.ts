import axios from "axios";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import {
  type AccountOwnershipDataSource,
  type AccountOwnershipDescriptor,
  type GetAccountOwnershipParams,
} from "@/account-ownership/data/AccountOwnershipDataSource";
import { AccountOwnershipError } from "@/account-ownership/data/AccountOwnershipError";
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
          new AccountOwnershipError(
            "service_unavailable",
            "[ContextModule] HttpAccountOwnershipDataSource: unexpected empty response",
          ),
        );
      }

      if (!this.isAccountOwnershipDto(response.data)) {
        return Left(
          new AccountOwnershipError(
            "service_unavailable",
            "[ContextModule] HttpAccountOwnershipDataSource: invalid response format",
          ),
        );
      }

      return Right({
        signedDescriptor: response.data.signedDescriptor,
        keyId: response.data.keyId,
        keyUsage: response.data.keyUsage,
      });
    } catch (error) {
      return Left(this.classifyError(error));
    }
  }

  /**
   * Classifies a caught request error into an {@link AccountOwnershipError}:
   * HTTP 4xx responses carry the backend's `message` verbatim and are marked
   * as `verification_failed`; everything else (network failure, 5xx,
   * non-axios errors) is marked as `service_unavailable`.
   */
  private classifyError(error: unknown): AccountOwnershipError {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const backendMessage = this.extractBackendMessage(
        error.response.data,
        error.message,
      );

      if (status >= 400 && status < 500) {
        return new AccountOwnershipError("verification_failed", backendMessage);
      }

      return new AccountOwnershipError(
        "service_unavailable",
        `[ContextModule] HttpAccountOwnershipDataSource: backend ${status}: ${backendMessage}`,
      );
    }

    return new AccountOwnershipError(
      "service_unavailable",
      "[ContextModule] HttpAccountOwnershipDataSource: Failed to fetch account ownership descriptor",
    );
  }

  private extractBackendMessage(data: unknown, fallback: string): string {
    if (typeof data === "string" && data.length > 0) {
      return data;
    }
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string" &&
      (data as { message: string }).message.length > 0
    ) {
      return (data as { message: string }).message;
    }
    return fallback;
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
