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
  calldata_index?: never;
  type: "field" | "message" | "calldata";
};

export type InstructionFieldV2WithCoinRef = {
  display_name: string;
  field_mappers_count?: never;
  format: "token" | "amount";
  field_path: string;
  coin_ref: number;
  name_types?: never;
  name_sources?: never;
  calldata_index?: never;
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
  calldata_index?: never;
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

export type InstructionCalldataParamPresence =
  | "none"
  | "present"
  | "verifying_contract";

export type InstructionCalldataInfo = {
  display_name: string;
  field_mappers_count?: never;
  field_path?: never;
  calldata_index: number;
  value_filter_flag: boolean;
  callee_filter_flag: InstructionCalldataParamPresence;
  chain_id_filter_flag: boolean;
  selector_filter_flag: boolean;
  amount_filter_flag: boolean;
  spender_filter_flag: InstructionCalldataParamPresence;
  descriptor: string;
  signatures: InstructionSignatures;
  type: "calldata";
};

export type InstructionFieldV2Calldata = {
  format:
    | "calldata-value"
    | "calldata-callee"
    | "calldata-chain-id"
    | "calldata-selector"
    | "calldata-amount"
    | "calldata-spender";
  field_mappers_count?: never;
  coin_ref?: never;
  display_name: string;
  field_path: string;
  calldata_index: number;
  descriptor: string;
  signatures: InstructionSignatures;
  type: "field";
};

export type InstructionField =
  | InstructionFieldV1
  | InstructionFieldV2
  | InstructionFieldV2WithCoinRef
  | InstructionFieldV2WithName
  | InstructionContractInfo
  | InstructionCalldataInfo
  | InstructionFieldV2Calldata;

export type FiltersDto = {
  descriptors_eip712: {
    [contractAddress: string]: {
      [schemaHash: string]: {
        instructions: InstructionField[];
      };
    };
  };
};
