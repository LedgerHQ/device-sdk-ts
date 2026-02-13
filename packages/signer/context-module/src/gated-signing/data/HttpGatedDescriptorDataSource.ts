import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import {
  type GetGatedDescriptorParams,
  type GetGatedDescriptorResponse,
  type GatedDescriptorDataSource,
} from "./GatedDescriptorDataSource";
import { type GatedDappsDto } from "./dto/GatedDappsDto";

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

    if (!Array.isArray(dto) || dto.length === 0) {
      return Left(
        new Error(
          `[ContextModule] HttpGatedDescriptorDataSource: Response is not a non-empty array`,
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
        return Right({ descriptor: entry.descriptor });
      }
    }

    return Left(
      new Error(
        `[ContextModule] HttpGatedDescriptorDataSource: No gated descriptor for contract ${contractAddress} and selector ${selector}`,
      ),
    );
  }
}
