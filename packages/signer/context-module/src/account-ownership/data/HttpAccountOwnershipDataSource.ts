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
   * unrecognized errors) is marked as `service_unavailable`.
   *
   * Two shapes are recognized:
   * - Vanilla {@link AxiosError} with `.response` (standalone axios usage).
   * - Any error carrying a numeric `.status` field. Consumers may install a
   *   global axios interceptor that replaces {@link AxiosError} with a
   *   custom class, typically stripping `.response` but preserving the HTTP
   *   status on a top-level `.status` field. The duck-typed branch keeps
   *   classification correct on those paths without coupling to any
   *   host-specific class.
   */
  private classifyError(error: unknown): AccountOwnershipError {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const backendMessage = this.extractBackendMessage(
        error.response.data,
        error.message,
      );
      return this.classifyFromStatus(status, backendMessage);
    }

    if (this.hasNumericStatus(error)) {
      const status = error.status;
      const message = this.extractErrorMessage(error);
      return this.classifyFromStatus(status, message);
    }

    return new AccountOwnershipError(
      "service_unavailable",
      "[ContextModule] HttpAccountOwnershipDataSource: Failed to fetch account ownership descriptor",
    );
  }

  private classifyFromStatus(
    status: number,
    message: string,
  ): AccountOwnershipError {
    if (status >= 400 && status < 500) {
      return new AccountOwnershipError("verification_failed", message);
    }
    return new AccountOwnershipError(
      "service_unavailable",
      `[ContextModule] HttpAccountOwnershipDataSource: backend ${status}: ${message}`,
    );
  }

  private hasNumericStatus(value: unknown): value is { status: number } {
    return (
      typeof value === "object" &&
      value !== null &&
      "status" in value &&
      typeof (value as { status: unknown }).status === "number"
    );
  }

  private extractErrorMessage(value: unknown): string {
    if (
      typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof (value as { message: unknown }).message === "string"
    ) {
      return (value as { message: string }).message;
    }
    if (typeof value === "string") {
      return value;
    }
    return "Unknown error";
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
