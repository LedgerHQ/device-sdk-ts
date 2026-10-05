import { type Either } from "purify-ts";

import { type TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";

// Steps of an EIP712_PATH, walked from the root of the message
export type TypedDataPathElement =
  | { type: "struct_field"; index: number }
  | { type: "array_slice"; start?: number; end?: number };

export type TypedDataDescriptorField = {
  payload: string;
  tokenPath?: TypedDataPathElement[];
};

export type GetTypedDataDescriptorsParams = {
  address: string;
  chainId: number;
  schema: TypedDataSchema;
  primaryType: string;
};

export type GetTypedDataDescriptorsResult = {
  messageInfo: string;
  fields: TypedDataDescriptorField[];
};

export interface TypedDataDescriptorDataSource {
  getTypedDataDescriptors(
    params: GetTypedDataDescriptorsParams,
  ): Promise<Either<Error, GetTypedDataDescriptorsResult>>;
}
