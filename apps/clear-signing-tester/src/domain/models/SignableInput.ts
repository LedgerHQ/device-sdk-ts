import { type TransactionInput } from "./TransactionInput";
import { type TypedDataInput } from "./TypedDataInput";

// Discriminated union of all signing input types. Dispatch on `kind`
export type SignableInput = TransactionInput | TypedDataInput;
