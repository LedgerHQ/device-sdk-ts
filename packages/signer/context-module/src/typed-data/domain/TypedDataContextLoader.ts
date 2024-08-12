import type { TypedDataClearSignContext } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";

export interface TypedDataContextLoader {
  load(typedData: TypedDataContext): Promise<TypedDataClearSignContext>;
}
