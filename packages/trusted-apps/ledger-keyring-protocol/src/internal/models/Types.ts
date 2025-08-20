export type PublishedKey = {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
};

export type EncryptedPublishedKey = {
  encryptedXpriv: Uint8Array;
  initializationVector: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};
