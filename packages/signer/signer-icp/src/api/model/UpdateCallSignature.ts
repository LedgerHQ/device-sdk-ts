// A combined-sign signature: raw r‖s only. Unlike the transfer path, the ICP
// app's SIGN_COMBINED response carries no recovery byte or DER encoding.
export type CombinedSignature = {
  r: string;
  s: string;
};

// Raw device response of update-call signing (INS 0x03). The device signs the
// call request together with its companion read-state request and returns the
// signed digest and r‖s signature of each.
export type DeviceUpdateCallSignature = {
  requestHash: string;
  requestSignature: CombinedSignature;
  readStateHash: string;
  readStateSignature: CombinedSignature;
};

// Result surfaced to the caller: the device response plus the read-state
// request that was signed, so the caller can submit the call and poll its
// status while keeping the request ↔ read-state pairing intact.
export type UpdateCallSignature = DeviceUpdateCallSignature & {
  readStateBody: Uint8Array;
};
