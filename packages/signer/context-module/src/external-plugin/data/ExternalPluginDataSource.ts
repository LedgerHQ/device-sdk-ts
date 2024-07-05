import { Either } from "purify-ts";

import { DappInfos } from "@/external-plugin/model/DappInfos";
import { HexString } from "@/shared/model/HexString";

export type GetDappInfos = {
  address: string;
  selector: HexString;
  chainId: number;
};

export interface ExternalPluginDataSource {
  getDappInfos(
    params: GetDappInfos,
  ): Promise<Either<Error, DappInfos | undefined>>;
}
