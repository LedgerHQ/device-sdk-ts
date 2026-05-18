import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  type AccountOwnershipDataSource,
  type AccountOwnershipDescriptor,
  type GetAccountOwnershipParams,
} from "@/modules/concordium/account-ownership/data/AccountOwnershipDataSource";
import { AccountOwnershipError } from "@/modules/concordium/account-ownership/data/AccountOwnershipError";
import { type AccountOwnershipDto } from "@/modules/concordium/account-ownership/data/dto/AccountOwnershipDto";
import { networkTypes } from "@/shared/network/di/networkTypes";

@injectable()
export class HttpAccountOwnershipDataSource
  implements AccountOwnershipDataSource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
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
      const data = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v2/concordium/owner/${publicKey}/${address}`,
        {
          params: { challenge, network },
        },
      )) as AccountOwnershipDto | null;

      if (!data) {
        return Left(
          new AccountOwnershipError(
            "service_unavailable",
            "[ContextModule] HttpAccountOwnershipDataSource: unexpected empty response",
          ),
        );
      }

      if (!this.isAccountOwnershipDto(data)) {
        return Left(
          new AccountOwnershipError(
            "service_unavailable",
            "[ContextModule] HttpAccountOwnershipDataSource: invalid response format",
          ),
        );
      }

      return Right({
        signedDescriptor: data.signedDescriptor,
        keyId: data.keyId,
        keyUsage: data.keyUsage,
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
   * Errors with a numeric `.status` field are treated as HTTP-shaped
   * failures. `DmkNetworkClientError` exposes `.status` and a raw
   * `.responseBody` string; the backend's human-readable message is
   * extracted from the error's own `.message` first, then from the JSON
   * body on `.responseBody`, and finally from the raw body as a
   * last resort.
   */
  private classifyError(error: unknown): AccountOwnershipError {
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
    const fromBody = this.extractResponseBodyMessage(value);
    if (fromBody !== null) {
      return fromBody;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof (value as { message: unknown }).message === "string" &&
      (value as { message: string }).message.length > 0
    ) {
      return (value as { message: string }).message;
    }
    if (typeof value === "string") {
      return value;
    }
    return "Unknown error";
  }

  private extractResponseBodyMessage(value: unknown): string | null {
    if (
      typeof value !== "object" ||
      value === null ||
      !("responseBody" in value) ||
      typeof (value as { responseBody: unknown }).responseBody !== "string"
    ) {
      return null;
    }
    const body = (value as { responseBody: string }).responseBody;
    if (body.length === 0) {
      return null;
    }
    try {
      const parsed = JSON.parse(body) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "message" in parsed &&
        typeof (parsed as { message: unknown }).message === "string" &&
        (parsed as { message: string }).message.length > 0
      ) {
        return (parsed as { message: string }).message;
      }
    } catch {
      // body is not JSON; fall through to use it as plain text
    }
    return body;
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
