import { Either } from "purify-ts";

import {
  TypedDataFilter,
  TypedDataMessageInfo,
} from "@/shared/model/TypedDataClearSignContext";
import { TypedDataSchema } from "@/shared/model/TypedDataContext";

export type GetTypedDataFiltersParams = {
  address: string;
  chainId: number;
  version: "v1" | "v2";
  schema: TypedDataSchema;
};

export type GetTypedDataFiltersResult = {
  messageInfo: TypedDataMessageInfo;
  filters: TypedDataFilter[];
};

export interface TypedDataDataSource {
  getTypedDataFilters(
    params: GetTypedDataFiltersParams,
  ): Promise<Either<Error, GetTypedDataFiltersResult>>;
}
