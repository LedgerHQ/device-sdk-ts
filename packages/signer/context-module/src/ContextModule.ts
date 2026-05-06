import { type BlindSigningReportParams } from "@/modules/chain-agnostic/reporter/data/BlindSigningReporterDatasource";
import {
  type ClearSignContext,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";

import { type TypedDataClearSignContext } from "./shared/model/TypedDataClearSignContext";
import { type TypedDataContext } from "./shared/model/TypedDataContext";

export interface ContextModule {
  getContexts<TInput>(
    input: TInput,
    expectedTypes?: ClearSignContextType[],
  ): Promise<ClearSignContext[]>;
  getFieldContext<TInput>(
    field: TInput,
    expectedType: ClearSignContextType,
  ): Promise<ClearSignContext>;
  getTypedDataFilters(
    typedData: TypedDataContext,
  ): Promise<TypedDataClearSignContext>;
  report(params: BlindSigningReportParams): Promise<void>;
}
