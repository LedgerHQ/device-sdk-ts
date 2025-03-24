export type InstructionSignatures =
  | {
      prod: string;
      test?: string;
    }
  | {
      prod?: string;
      test: string;
    };

export type InstructionFieldV1 = {
  display_name: string;
  field_mappers_count?: never;
  field_path: string;
  signatures: InstructionSignatures;
  type: "field" | "message";
  format?: never;
};

export type InstructionFieldV2 = {
  display_name: string;
  field_mappers_count?: never;
  field_path: string;
  descriptor: string;
  signatures: InstructionSignatures;
  format: "raw" | "datetime";
  coin_ref?: never;
  name_types?: never;
  name_sources?: never;
  type: "field" | "message";
};

export type InstructionFieldV2WithCoinRef = {
  display_name: string;
  field_mappers_count?: never;
  format: "token" | "amount";
  field_path: string;
  coin_ref: number;
  name_types?: never;
  name_sources?: never;
  descriptor: string;
  signatures: InstructionSignatures;
  type: "field";
};

export type InstructionFieldV2WithName = {
  display_name: string;
  field_mappers_count?: never;
  format: "trusted-name";
  field_path: string;
  coin_ref?: never;
  name_types: string[];
  name_sources: string[];
  descriptor: string;
  signatures: InstructionSignatures;
  type: "field";
};

export type InstructionContractInfo = {
  display_name: string;
  field_mappers_count: number;
  field_path?: never;
  descriptor: string;
  signatures: InstructionSignatures;
  type: "message";
};

export type InstructionField =
  | InstructionFieldV1
  | InstructionFieldV2
  | InstructionFieldV2WithCoinRef
  | InstructionFieldV2WithName
  | InstructionContractInfo;

export type FiltersDto = {
  descriptors_eip712: {
    [contractAddress: string]: {
      [schemaHash: string]: {
        schema: Record<string, { name: string; type: string }[]>;
        instructions: InstructionField[];
      };
    };
  };
};
