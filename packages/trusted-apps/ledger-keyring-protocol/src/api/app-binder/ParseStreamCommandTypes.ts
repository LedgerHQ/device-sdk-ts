import { type TrustedProperty } from "@internal/externalTypes";

export type ParseStreamCommandResponse = {
  readonly trustedProperty: Partial<TrustedProperty>;
};

export type ParseStreamCommandArgs = {
  readonly payload: Uint8Array;
  readonly p1: 0x00 | 0x01 | 0x02 | 0x03;
};
