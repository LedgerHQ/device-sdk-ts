import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
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

  async getDappInfos({
    chainId,
    address,
    selector,
  }: GetDappInfos): Promise<Either<Error, DappInfos | undefined>> {
    try {
      const dappInfos = (await this.http.get(`${this.config.cal.url}/dapps`, {
        params: {
          output: "b2c,b2c_signatures,abis",
          chain_id: chainId,
          contracts: address,
        },
      })) as DAppDto[];

      if (!dappInfos[0]) {
        return Right(undefined);
      }

      // Normalize the address and selector
      address = address.toLowerCase();
      selector = `0x${selector.slice(2).toLowerCase()}`;

      const { erc20OfInterest, method, plugin } =
        dappInfos[0].b2c?.contracts?.find((c) => c.address === address)
          ?.selectors?.[selector] || {};
      const { signature, serialized_data: serializedData } =
        dappInfos[0].b2c_signatures?.[address]?.[selector] || {};

      if (
        !erc20OfInterest ||
        !method ||
        !plugin ||
        !signature ||
        !serializedData
      ) {
        return Right(undefined);
      }

      const abi = dappInfos[0].abis?.[address];

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
