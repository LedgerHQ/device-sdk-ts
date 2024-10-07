export type FilterFieldSignatures = {
  prod: string;
  test: string;
};

export type FilterFieldV1 = {
  display_name: string;
  field_mappers_count?: never;
  field_path: string;
  signatures: FilterFieldSignatures;
  type: "field" | "message";
  format?: never;
};

export type FilterFieldV2 = {
  display_name: string;
  field_mappers_count?: never;
  field_path: string;
  descriptor: string;
  signatures: FilterFieldSignatures;
  format: "raw" | "datetime";
  coin_ref?: never;
  type: "field" | "message";
};

export type FilterFieldV2WithCoinRef = {
  display_name: string;
  field_mappers_count?: never;
  format: "token" | "amount";
  field_path: string;
  coin_ref: number;
  descriptor: string;
  signatures: FilterFieldSignatures;
  type: "field";
};

export type FilterFieldWithContractInfo = {
  display_name: string;
  field_mappers_count: number;
  field_path?: never;
  descriptor: string;
  signatures: FilterFieldSignatures;
  type: "message";
};

export type FilterField =
  | FilterFieldV1
  | FilterFieldV2
  | FilterFieldV2WithCoinRef
  | FilterFieldWithContractInfo;

export type FiltersDto = {
  descriptors_eip712: {
    [contractAddress: string]: {
      [schemaHash: string]: {
        schema: Record<string, { name: string; type: string }[]>;
        instructions: FilterField[];
      };
    };
  };
};
