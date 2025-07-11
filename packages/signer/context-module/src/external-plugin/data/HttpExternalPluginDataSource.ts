import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { DAppDto } from "@/external-plugin/data/DAppDto";
import {
  ExternalPluginDataSource,
  GetDappInfos,
} from "@/external-plugin/data/ExternalPluginDataSource";
import { DappInfos } from "@/external-plugin/model/DappInfos";
import { SelectorDetails } from "@/external-plugin/model/SelectorDetails";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

@injectable()
export class HttpExternalPluginDataSource implements ExternalPluginDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  async getDappInfos({
    chainId,
    address,
    selector,
  }: GetDappInfos): Promise<Either<Error, DappInfos | undefined>> {
    try {
      const dappInfos = await axios.request<DAppDto[]>({
        method: "GET",
        url: `${this.config.cal.url}/dapps`,
        params: {
          output: "b2c,b2c_signatures,abis",
          chain_id: chainId,
          contracts: address,
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });

      if (!dappInfos.data[0]) {
        return Right(undefined);
      }

      // Normalize the address and selector
      address = address.toLowerCase();
      selector = `0x${selector.slice(2).toLowerCase()}`;

      const { erc20OfInterest, method, plugin } =
        dappInfos.data[0].b2c?.contracts?.find((c) => c.address === address)
          ?.selectors?.[selector] || {};
      const { signature, serialized_data: serializedData } =
        dappInfos.data[0].b2c_signatures?.[address]?.[selector] || {};

      if (
        !erc20OfInterest ||
        !method ||
        !plugin ||
        !signature ||
        !serializedData
      ) {
        return Right(undefined);
      }

      const abi = dappInfos.data[0].abis?.[address];

      if (!abi) {
        return Right(undefined);
      }

      const selectorDetails: SelectorDetails = {
        method,
        plugin,
        erc20OfInterest,
        signature,
        serializedData,
      };

      return Right({ selectorDetails, abi });
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpExternalPluginDataSource: Error fetching dapp infos",
        ),
      );
    }
  }
}
