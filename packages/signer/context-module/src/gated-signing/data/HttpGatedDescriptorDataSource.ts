import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import { SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";
import PACKAGE from "@root/package.json";

import {
  type GatedDappsDto,
  type GatedDappsResponseItemDto,
  type GatedDescriptorEntryDto,
} from "./dto/GatedDappsDto";
import {
  type GatedDescriptorDataSource,
  type GetGatedDescriptorParams,
  type GetGatedDescriptorResponse,
} from "./GatedDescriptorDataSource";

@injectable()
export class HttpGatedDescriptorDataSource
  implements GatedDescriptorDataSource
{
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  async getGatedDescriptor({
    contractAddress,
    selector,
    chainId,
  }: GetGatedDescriptorParams): Promise<
    Either<Error, GetGatedDescriptorResponse>
  > {
    let dto: GatedDappsDto | undefined;
    try {
      const response = await axios.request<GatedDappsDto>({
        method: "GET",
        url: `${this.config.cal.url}/gated_dapps`,
        params: {
          ref: `branch:${this.config.cal.branch}`,
          output: "gated_descriptors",
          contracts: contractAddress,
          chain_id: chainId,
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });
      dto = response.data;
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpGatedDescriptorDataSource: Failed to fetch gated descriptors: ${error}`,
        ),
      );
    }

    if (!this.isGatedDappsDto(dto)) {
      return Left(
        new Error(
          `[ContextModule] HttpGatedDescriptorDataSource: Invalid gated descriptors response`,
        ),
      );
    }

    const normalizedAddress = contractAddress.toLowerCase();
    const selectorWithout0x = selector.startsWith("0x")
      ? selector.slice(2).toLowerCase()
      : selector.toLowerCase();
    const selectorWith0x = `0x${selectorWithout0x}`;

    for (const item of dto) {
      const byContract = item.gated_descriptors?.[normalizedAddress];
      if (!byContract) continue;

      const entry =
        byContract[selectorWithout0x] ??
        byContract[selectorWith0x] ??
        byContract[selector];
      if (entry?.descriptor) {
        return Right({
          signedDescriptor: HexStringUtils.appendSignatureToPayload(
            entry.descriptor,
            entry.signatures![this.config.cal.mode]!,
            SIGNATURE_TAG,
          ),
        });
      }
    }

    return Left(
      new Error(
        `[ContextModule] HttpGatedDescriptorDataSource: No gated descriptor for contract ${contractAddress} and selector ${selector}`,
      ),
    );
  }

  private isGatedDappsDto(data: unknown): data is GatedDappsDto {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }
    for (const item of data) {
      if (!this.isGatedDappsResponseItemDto(item)) {
        return false;
      }
    }
    return true;
  }

  private isGatedDappsResponseItemDto(
    item: unknown,
  ): item is GatedDappsResponseItemDto {
    if (!item || typeof item !== "object") {
      return false;
    }
    const obj = item as Record<string, unknown>;
    if (
      !obj["gated_descriptors"] ||
      typeof obj["gated_descriptors"] !== "object"
    ) {
      return false;
    }
    const byContract = obj["gated_descriptors"] as Record<string, unknown>;
    for (const selectorsMap of Object.values(byContract)) {
      if (typeof selectorsMap !== "object" || selectorsMap === null) {
        return false;
      }
      for (const entry of Object.values(
        selectorsMap as Record<string, unknown>,
      )) {
        if (!this.isGatedDescriptorEntryDto(entry)) {
          return false;
        }
      }
    }
    return true;
  }

  private isGatedDescriptorEntryDto(
    entry: unknown,
  ): entry is GatedDescriptorEntryDto {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const e = entry as Record<string, unknown>;
    if (
      typeof e["network"] !== "string" ||
      typeof e["chain_id"] !== "number" ||
      typeof e["address"] !== "string" ||
      typeof e["selector"] !== "string" ||
      typeof e["version"] !== "string" ||
      typeof e["descriptor"] !== "string"
    ) {
      return false;
    }
    if (e["signatures"] !== undefined) {
      if (typeof e["signatures"] !== "object" || e["signatures"] === null) {
        return false;
      }
      const sigs = e["signatures"] as Record<string, unknown>;
      for (const v of Object.values(sigs)) {
        if (typeof v !== "string") {
          return false;
        }
      }
    }
    return true;
  }
}
