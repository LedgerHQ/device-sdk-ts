import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { SafeAccountDto, SafeDescriptorDto } from "./dto/SafeAccountDto";
import {
  type GetSafeAccountParams,
  type GetSafeAccountResponse,
  type SafeAccountDataSource,
} from "./SafeAccountDataSource";

export class HttpSafeAccountDataSource implements SafeAccountDataSource {
  private readonly http: DmkNetworkClient;

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
  ) {
    this.http = new DmkNetworkClient({
      headers: {
        [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        ...(this.config.originToken && {
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        }),
      },
    });
  }

  async getDescriptors({
    safeContractAddress,
    chainId,
    challenge,
  }: GetSafeAccountParams): Promise<Either<Error, GetSafeAccountResponse>> {
    try {
      const data = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v2/ethereum/${chainId}/safe/account/${safeContractAddress}`,
        { params: { challenge } },
      )) as SafeAccountDto;

      if (!data) {
        return Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: unexpected empty response",
          ),
        );
      }

      if (!this.isSafeAccountDto(data)) {
        return Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        );
      }

      return Right({
        account: {
          signedDescriptor: data.accountDescriptor.signedDescriptor,
          keyId: data.accountDescriptor.keyId,
          keyUsage: data.accountDescriptor.keyUsage,
        },
        signers: {
          signedDescriptor: data.signersDescriptor.signedDescriptor,
          keyId: data.signersDescriptor.keyId,
          keyUsage: data.signersDescriptor.keyUsage,
        },
      });
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpSafeAccountDataSource: Failed to fetch safe account descriptors",
        ),
      );
    }
  }

  private isSafeAccountDto(value: unknown): value is SafeAccountDto {
    return (
      typeof value === "object" &&
      value !== null &&
      "accountDescriptor" in value &&
      "signersDescriptor" in value &&
      typeof value.accountDescriptor === "object" &&
      typeof value.signersDescriptor === "object" &&
      this.isSafeDescriptorDto(value.accountDescriptor) &&
      this.isSafeDescriptorDto(value.signersDescriptor)
    );
  }

  private isSafeDescriptorDto(value: unknown): value is SafeDescriptorDto {
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
