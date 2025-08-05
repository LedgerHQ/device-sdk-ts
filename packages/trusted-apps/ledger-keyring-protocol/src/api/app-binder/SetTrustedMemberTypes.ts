export type SetTrustedMemberCommandResponse = void;

export type SetTrustedMemberCommandArgs = {
  readonly iv: Uint8Array;
  readonly memberTlv: Uint8Array;
};
