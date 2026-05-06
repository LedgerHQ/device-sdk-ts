import { type Either } from "purify-ts";

import {
  type TypedDataCalldataIndex,
  type TypedDataFilter,
  type TypedDataFilterCalldataInfo,
  type TypedDataMessageInfo,
} from "@/modules/ethereum/model/TypedDataClearSignContext";
import { type TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";

export type GetTypedDataFiltersParams = {
  address: string;
  chainId: number;
  version: "v1" | "v2";
  schema: TypedDataSchema;
};

export type GetTypedDataFiltersResult = {
  messageInfo: TypedDataMessageInfo;
  filters: TypedDataFilter[];
  calldatasInfos: Record<TypedDataCalldataIndex, TypedDataFilterCalldataInfo>;
};

export interface TypedDataDataSource {
  getTypedDataFilters(
    params: GetTypedDataFiltersParams,
  ): Promise<Either<Error, GetTypedDataFiltersResult>>;
}
