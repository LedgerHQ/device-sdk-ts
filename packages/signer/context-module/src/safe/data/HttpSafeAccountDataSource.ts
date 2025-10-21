import axios from "axios";
import { inject } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
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
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  async getDescriptors({
    safeContractAddress,
    chainId,
    challenge,
  }: GetSafeAccountParams): Promise<Either<Error, GetSafeAccountResponse>> {
    try {
      const response = await axios.request<SafeAccountDto>({
        method: "GET",
        url: `${this.config.metadataServiceDomain.url}/v2/ethereum/${chainId}/safe/account/${safeContractAddress}`,
        params: {
          challenge,
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });

      if (!response.data) {
        return Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: unexpected empty response",
          ),
        );
      }

      if (!this.isSafeAccountDto(response.data)) {
        return Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        );
      }

      return Right({
        account: {
          signedDescriptor: response.data.accountDescriptor.signedDescriptor,
          keyId: response.data.accountDescriptor.keyId,
          keyUsage: response.data.accountDescriptor.keyUsage,
        },
        signers: {
          signedDescriptor: response.data.signersDescriptor.signedDescriptor,
          keyId: response.data.signersDescriptor.keyId,
          keyUsage: response.data.signersDescriptor.keyUsage,
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
