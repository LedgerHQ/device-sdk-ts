import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";

export type StateHandlerResult = {
  status:
    | "ongoing"
    | "clear_signed"
    | "blind_signed"
    | "partially_clear_signed"
    | "error";
  errorMessage?: string;
};

export interface StateHandler {
  handle(ctx: {
    input: TransactionInput | TypedDataInput;
  }): Promise<StateHandlerResult>;
}
