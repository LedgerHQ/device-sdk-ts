import axios from "axios";
import { injectable } from "inversify";

import { DAppDto } from "@/external-plugin/data/DAppDto";
import {
  ExternalPluginDataSource,
  GetDappInfos,
} from "@/external-plugin/data/ExternalPluginDataSource";
import { DappInfos } from "@/external-plugin/model/DappInfos";
import { SelectorDetails } from "@/external-plugin/model/SelectorDetails";
import PACKAGE from "@root/package.json";

@injectable()
export class HttpExternalPluginDataSource implements ExternalPluginDataSource {
  constructor() {}

  async getDappInfos({
    chainId,
    address,
    selector,
  }: GetDappInfos): Promise<DappInfos | undefined> {
    try {
      const dappInfos = await axios.request<DAppDto[]>({
        method: "GET",
        url: "https://crypto-assets-service.api.ledger.com/v1/dapps",
        params: {
          output: "b2c,b2c_signatures,abis",
          chain_id: chainId,
          contracts: address,
        },
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      if (!dappInfos.data[0]) {
        return;
      }

      const { erc20OfInterest, method, plugin } =
        dappInfos.data[0].b2c?.contracts?.[0]?.selectors?.[selector] || {};
      const { signature, serialized_data: serializedData } =
        dappInfos.data[0].b2c_signatures?.[address]?.[selector] || {};

      if (
        !erc20OfInterest ||
        !method ||
        !plugin ||
        !signature ||
        !serializedData
      ) {
        return;
      }

      const abi = dappInfos.data[0].abis?.[address];

      if (!abi) {
        return;
      }

      const selectorDetails: SelectorDetails = {
        method,
        plugin,
        erc20OfInterest,
        signature,
        serializedData,
      };

      return { selectorDetails, abi };
    } catch (error) {
      return;
    }
  }
}