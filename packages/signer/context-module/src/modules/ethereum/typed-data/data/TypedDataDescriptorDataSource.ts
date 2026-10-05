import { type Either } from "purify-ts";

import { type TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";

export type GetTypedDataDescriptorsParams = {
  address: string;
  chainId: number;
  schema: TypedDataSchema;
  primaryType: string;
};

export type GetTypedDataDescriptorsResult = {
  messageInfo: string;
  fields: string[];
};

export interface TypedDataDescriptorDataSource {
  getTypedDataDescriptors(
    params: GetTypedDataDescriptorsParams,
  ): Promise<Either<Error, GetTypedDataDescriptorsResult>>;
}
