export type SetTrustedMemberCommandResponse = void;

export type SetTrustedMemberCommandArgs = {
  readonly iv: Uint8Array;
  readonly trustedMember: Uint8Array;
};
