import { type SignableInputKind } from "./SignableInputKind";

export type TypedDataInput = {
  readonly kind: SignableInputKind.TypedData;
  readonly data: string;
  readonly description?: string;
  readonly expectedTexts?: string[];
};
