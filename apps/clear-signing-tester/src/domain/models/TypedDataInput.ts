import { type SignableInputKind } from "./SignableInputKind";

/** Domain model representing EIP-712 typed data to be signed on the device. */
export type TypedDataInput = {
  readonly kind: SignableInputKind.TypedData;
  readonly data: string;
  readonly description?: string;
  readonly expectedTexts?: string[];
  /** Texts that must NOT appear on any screen of this signing flow. */
  readonly unexpectedTexts?: string[];
};
