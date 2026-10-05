import { type TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";

// Context needed to fetch the EIP-712 V2 clear signing descriptors of a typed message
export type TypedDataDescriptorContext = {
  verifyingContract: string;
  chainId: number;
  schema: TypedDataSchema;
  primaryType: string;
  message: Record<string, unknown>;
};

export type TypedDataDescriptorClearSignContextSuccess = {
  type: "success";
  messageInfo: string;
  fields: string[];
  tokens: string[];
};

export type TypedDataDescriptorClearSignContext =
  | TypedDataDescriptorClearSignContextSuccess
  | {
      type: "error";
      error: Error;
    };
