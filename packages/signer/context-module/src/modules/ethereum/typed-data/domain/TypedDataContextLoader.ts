import type { TypedDataClearSignContext } from "@/modules/ethereum/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/modules/ethereum/model/TypedDataContext";

export interface TypedDataContextLoader {
  load(typedData: TypedDataContext): Promise<TypedDataClearSignContext>;
}
