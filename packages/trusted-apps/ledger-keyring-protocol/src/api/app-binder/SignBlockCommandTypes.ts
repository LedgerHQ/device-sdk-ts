import { type TrustedProperty } from "@internal/externalTypes";

export type SignBlockCommandResponse = {
  readonly trustedProperty: Partial<TrustedProperty>;
};

export type SignBlockCommandArgs = {
  readonly p1: 0x00 | 0x01 | 0x02;
  readonly payload: Uint8Array;
};
