import {
  type CalldataDescriptorTypeFamilyV1,
  type CalldataEnumV1,
  type CalldataTransactionDescriptor,
} from "@/modules/ethereum/calldata/data/dto/CalldataDto";

export interface Eip712V2DescriptorDto {
  descriptors_calldata_eip712: {
    [address: string]: {
      [primaryTypeHash: string]: Eip712V2Descriptor;
    };
  };
}

export interface Eip712V2Descriptor {
  type: "eip712";
  version: "v1";
  chain_id: number;
  address: string;
  primary_type_hash: string;
  message_info: {
    descriptor: CalldataTransactionDescriptor;
  };
  enums: CalldataEnumV1;
  fields: Eip712V2FieldDto[];
}

export interface Eip712V2FieldDto {
  descriptor: string;
  param: Eip712V2ParamDto;
}

export type Eip712V2ParamDto =
  | {
      type: "RAW" | "AMOUNT" | "DATETIME" | "DURATION" | "UNIT";
      value: Eip712V2ValueDto;
    }
  | { type: "TOKEN_AMOUNT"; value: Eip712V2ValueDto; token?: Eip712V2ValueDto }
  | { type: "NFT"; value: Eip712V2ValueDto; collection: Eip712V2ValueDto }
  | { type: "ENUM"; value: Eip712V2ValueDto; id: number }
  | {
      type: "TRUSTED_NAME";
      value: Eip712V2ValueDto;
      types: string[];
      sources: string[];
    }
  | { type: "CALLDATA"; value: Eip712V2ValueDto; callee: Eip712V2ValueDto };

export type Eip712V2ValueDto =
  | {
      type: "path";
      binary_path: Eip712V2BinaryPathDto | Eip712V2ContainerPathDto;
      type_family: CalldataDescriptorTypeFamilyV1;
      type_size?: number;
    }
  | {
      type: "constant";
      value: string;
      type_family: CalldataDescriptorTypeFamilyV1;
      type_size?: number;
    };

export interface Eip712V2BinaryPathDto {
  type: "EIP712";
  elements: Eip712V2PathElementDto[];
}

export interface Eip712V2ContainerPathDto {
  type: "CONTAINER";
  value: "FROM" | "TO" | "CHAIN_ID";
}

export type Eip712V2PathElementDto =
  | { type: "struct_field"; index: number }
  | { type: "array_slice"; start?: number; end?: number }
  | { type: "leaf_slice"; start?: number; end?: number };
