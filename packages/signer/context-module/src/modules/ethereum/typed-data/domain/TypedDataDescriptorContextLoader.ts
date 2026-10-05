import type {
  TypedDataDescriptorClearSignContext,
  TypedDataDescriptorContext,
} from "@/modules/ethereum/model/TypedDataDescriptorContext";

export interface TypedDataDescriptorContextLoader {
  load(
    typedData: TypedDataDescriptorContext,
  ): Promise<TypedDataDescriptorClearSignContext>;
}
