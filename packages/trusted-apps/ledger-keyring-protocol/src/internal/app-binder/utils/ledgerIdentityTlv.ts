const TAG_INTENT = 0x01;
const TAG_BLOB = 0x02;

export function buildVaultPayload(
  intent: string,
  blob: Uint8Array,
): Uint8Array {
  const intentBytes = new TextEncoder().encode(intent);

  // Tag 0x01 + 1-byte length + intent UTF-8
  const intentTlvLen = 1 + 1 + intentBytes.length;
  // Tag 0x02 + 2-byte BE length + blob
  const blobTlvLen = 1 + 2 + blob.length;

  const result = new Uint8Array(intentTlvLen + blobTlvLen);
  let offset = 0;

  result[offset++] = TAG_INTENT;
  result[offset++] = intentBytes.length;
  result.set(intentBytes, offset);
  offset += intentBytes.length;

  result[offset++] = TAG_BLOB;
  result[offset++] = (blob.length >> 8) & 0xff;
  result[offset++] = blob.length & 0xff;
  result.set(blob, offset);

  return result;
}
