export type FilterFieldV1 = {
  label: string;
  path: string;
  signature: string;
  format?: never;
};

export type FilterFieldV2 = {
  label: string;
  path: string;
  signature: string;
  format: "raw" | "datetime";
  coin_ref?: never;
};

export type FilterFieldV2WithCoinRef = {
  label: string;
  path: string;
  signature: string;
  format: "token" | "amount";
  coin_ref: number;
};

export type FilterField =
  | FilterFieldV1
  | FilterFieldV2
  | FilterFieldV2WithCoinRef;

export type FiltersDto = {
  eip712_signatures: {
    [contractAddress: string]: {
      [schemaHash: string]: {
        contractName: {
          label: string;
          signature: string;
        };
        fields: Array<FilterField>;
      };
    };
  };
};
