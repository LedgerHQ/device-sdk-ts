import { type SignableInput } from "@root/src/domain/models/SignableInput";

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
  handle(ctx: { input: SignableInput }): Promise<StateHandlerResult>;
}
