import { type HexaString } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type DappInfos } from "@/external-plugin/model/DappInfos";

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
