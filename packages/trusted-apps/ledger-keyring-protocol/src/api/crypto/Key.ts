export const AES256_KEY_SIZE = 32;
export const AES256_BLOCK_SIZE = 16;

export interface Key {
  encrypt(iv: Uint8Array, data: Uint8Array): Promise<Uint8Array>;
  decrypt(iv: Uint8Array, encryptedData: Uint8Array): Promise<Uint8Array>;
}
