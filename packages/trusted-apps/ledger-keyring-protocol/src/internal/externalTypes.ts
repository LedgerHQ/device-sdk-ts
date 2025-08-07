export const externalTypes = {
  Dmk: Symbol.for("Dmk"),
  SessionId: Symbol.for("SessionId"),
  ApplicationId: Symbol.for("ApplicationId"),
};

export type TrustedProperty = {
  iv: Uint8Array;
  issuer: Uint8Array;
  xpriv: Uint8Array;
  ephemeralPubKey: Uint8Array;
  commandIV: Uint8Array;
  groupKey: Uint8Array;
  newMember: Uint8Array;
};
