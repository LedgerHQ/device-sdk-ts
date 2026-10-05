import { type CalldataTransactionDescriptor } from "@/modules/ethereum/calldata/data/dto/CalldataDto";

export interface TypedDataDescriptorDto {
  descriptors_calldata_eip712: {
    [address: string]: {
      [primaryTypeHash: string]: TypedDataDescriptorV1;
    };
  };
}

export interface TypedDataDescriptorV1 {
  type: "eip712";
  version: "v1";
  chain_id: number;
  message_info: {
    descriptor: CalldataTransactionDescriptor;
  };
  fields: TypedDataDescriptorFieldV1[];
}

export interface TypedDataDescriptorFieldV1 {
  descriptor: string;
  param: {
    type: string;
    token?: TypedDataDescriptorValueV1;
  };
}

export type TypedDataDescriptorValueV1 =
  | {
      type: "path";
      binary_path: {
        type: "EIP712";
        elements: TypedDataDescriptorPathElementV1[];
      };
    }
  | {
      type: "constant";
    };

export type TypedDataDescriptorPathElementV1 =
  | { type: "struct_field"; index: number }
  | { type: "array_slice"; start?: number; end?: number };
