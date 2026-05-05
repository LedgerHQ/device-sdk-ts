export type GatedDescriptorEntryDto = {
  network: string;
  chain_id: number;
  address: string;
  selector: string;
  version: string;
  descriptor: string;
  signatures?: Record<string, string>;
};

export type GatedDescriptorsByContractDto = Record<
  string,
  Record<string, GatedDescriptorEntryDto>
>;

export type GatedDappsResponseItemDto = {
  gated_descriptors: GatedDescriptorsByContractDto;
};

export type GatedDappsDto = GatedDappsResponseItemDto[];
