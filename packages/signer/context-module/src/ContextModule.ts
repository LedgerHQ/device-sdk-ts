import { type BlindSigningReportParams } from "@/modules/multichain/reporter/BlindSigningReporterV1";
import { type SignReportParams } from "@/modules/multichain/sign-reporter/model/SignReportParams";
import {
  type ClearSignContext,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";

import { type TypedDataClearSignContext } from "./modules/ethereum/model/TypedDataClearSignContext";
import { type TypedDataContext } from "./modules/ethereum/model/TypedDataContext";

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
  /** @deprecated Does nothing: v1 blind signing reports are no longer sent. Use signReport instead; will be removed in the next major. */
  report(params: BlindSigningReportParams): Promise<void>;
  signReport?(params: SignReportParams): Promise<void>;
}
