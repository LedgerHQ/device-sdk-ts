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
  fields: {
    descriptor: string;
  }[];
}
