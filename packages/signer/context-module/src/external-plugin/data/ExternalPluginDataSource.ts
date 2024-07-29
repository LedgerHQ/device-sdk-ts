import { HexaString } from "@ledgerhq/device-sdk-core";
import { Either } from "purify-ts";

import { DappInfos } from "@/external-plugin/model/DappInfos";

export type GetDappInfos = {
  address: string;
  selector: HexaString;
  chainId: number;
};

export interface ExternalPluginDataSource {
  getDappInfos(
    params: GetDappInfos,
  ): Promise<Either<Error, DappInfos | undefined>>;
}
