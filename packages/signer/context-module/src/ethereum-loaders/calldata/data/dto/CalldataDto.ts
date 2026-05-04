export interface CalldataDto {
  descriptors_calldata: {
    [address: string]: {
      [selector: string]: CalldataDescriptor;
    };
  };
}

export type CalldataDescriptor = CalldataDescriptorV1; // For now only V1 descriptors are supported

export interface CalldataDescriptorV1 {
  type: "calldata";
  version: "v1";
  transaction_info: CalldataTransactionInfoV1;
  enums: CalldataEnumV1;
  fields: CalldataFieldV1[];
}

export type CalldataTransactionDescriptor = {
  data: string;
  signatures: CalldataSignatures;
};

export type CalldataSignatures =
  | {
      prod: string;
      test?: string;
    }
  | {
      prod?: string;
      test: string;
    };

export interface CalldataTransactionInfoV1 {
  descriptor: CalldataTransactionDescriptor;
}

export interface CalldataEnumV1 {
  [id: number]: {
    [value: number]: CalldataTransactionDescriptor;
  };
}

export interface CalldataFieldV1 {
  descriptor: string;
  param: CalldataDescriptorParam;
}

export type CalldataDescriptorParam =
  | CalldataDescriptorParamRawV1
  | CalldataDescriptorParamAmountV1
  | CalldataDescriptorParamTokenAmountV1
  | CalldataDescriptorParamNFTV1
  | CalldataDescriptorParamDatetimeV1
  | CalldataDescriptorParamDurationV1
  | CalldataDescriptorParamUnitV1
  | CalldataDescriptorParamEnumV1
  | CalldataDescriptorParamTrustedNameV1
  | CallDataDescriptorParamCalldataV1;

export interface CallDataDescriptorParamCalldataV1 {
  type: "CALLDATA";
  value: CalldataDescriptorValueV1;
  callee: CalldataDescriptorValueV1;
  selector?: CalldataDescriptorValueV1;
  amount?: CalldataDescriptorValueV1;
  spender?: CalldataDescriptorValueV1;
  chainId?: CalldataDescriptorValueV1;
}

export interface CalldataDescriptorParamRawV1 {
  type: "RAW";
  value: CalldataDescriptorValueV1;
}

export interface CalldataDescriptorParamAmountV1 {
  type: "AMOUNT";
  value: CalldataDescriptorValueV1;
}

export interface CalldataDescriptorParamTokenAmountV1 {
  type: "TOKEN_AMOUNT";
  value: CalldataDescriptorValueV1;
  token?: CalldataDescriptorValueV1;
}

export interface CalldataDescriptorParamNFTV1 {
  type: "NFT";
  value: CalldataDescriptorValueV1;
  collection: CalldataDescriptorValueV1;
}

export interface CalldataDescriptorParamDatetimeV1 {
  type: "DATETIME";
  value: CalldataDescriptorValueV1;
}

export interface CalldataDescriptorParamDurationV1 {
  type: "DURATION";
  value: CalldataDescriptorValueV1;
}

export interface CalldataDescriptorParamUnitV1 {
  type: "UNIT";
  value: CalldataDescriptorValueV1;
}

export interface CalldataDescriptorParamEnumV1 {
  type: "ENUM";
  value: CalldataDescriptorValueV1;
  id: number;
}

export interface CalldataDescriptorParamTrustedNameV1 {
  type: "TRUSTED_NAME";
  value: CalldataDescriptorValueV1;
  types: string[];
  sources: string[];
}

export interface CalldataDescriptorValueBinaryPathV1 {
  type: "path";
  binary_path:
    | CalldataDescriptorContainerPathV1
    | CalldataDescriptorPathElementsV1;
  type_family: CalldataDescriptorTypeFamilyV1;
  type_size?: number;
}

export interface CalldataDescriptorValueConstantV1 {
  type: "constant";
  value: string;
  type_family: CalldataDescriptorTypeFamilyV1;
  type_size?: number;
}

export type CalldataDescriptorValueV1 =
  | CalldataDescriptorValueBinaryPathV1
  | CalldataDescriptorValueConstantV1;

export interface CalldataDescriptorContainerPathV1 {
  type: "CONTAINER";
  value: CalldataDescriptorContainerPathTypeV1;
}

export interface CalldataDescriptorPathElementsV1 {
  type: "DATA";
  elements: CalldataDescriptorPathElementV1[];
}

export type CalldataDescriptorPathElementV1 =
  | CalldataDescriptorPathElementTupleV1
  | CalldataDescriptorPathElementArrayV1
  | CalldataDescriptorPathElementRefV1
  | CalldataDescriptorPathElementLeafV1
  | CalldataDescriptorPathElementSliceV1;

export interface CalldataDescriptorPathElementTupleV1 {
  type: "TUPLE";
  offset: number;
}

export interface CalldataDescriptorPathElementArrayV1 {
  type: "ARRAY";
  start?: number;
  end?: number;
  weight: number;
}

export interface CalldataDescriptorPathElementRefV1 {
  type: "REF";
}

export interface CalldataDescriptorPathElementLeafV1 {
  type: "LEAF";
  leaf_type: CalldataDescriptorPathLeafTypeV1;
}

export interface CalldataDescriptorPathElementSliceV1 {
  type: "SLICE";
  start?: number;
  end?: number;
}

export type CalldataDescriptorContainerPathTypeV1 = "FROM" | "TO" | "VALUE";
export type CalldataDescriptorPathLeafTypeV1 =
  | "ARRAY_LEAF"
  | "TUPLE_LEAF"
  | "STATIC_LEAF"
  | "DYNAMIC_LEAF";
export type CalldataDescriptorTypeFamilyV1 =
  | "UINT"
  | "INT"
  | "UFIXED"
  | "FIXED"
  | "ADDRESS"
  | "BOOL"
  | "BYTES"
  | "STRING";
