export type SetTrustedMemberCommandResponse = unknown;

export type SetTrustedMemberCommandArgs = {
  readonly p1: 0x00 | 0x01 | 0x02;
  readonly iv: Uint8Array;
  readonly trustedMember: Uint8Array;
};
