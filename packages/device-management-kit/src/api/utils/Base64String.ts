export function isBase64String(value: string): boolean {
  // Valid base64 characters are [A-Za-z0-9+/]
  // They are always grouped by 4 characters.
  // Optional padding at the end with one or two '='.
  // see section 4 of: https://www.rfc-editor.org/rfc/rfc4648.txt
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    value,
  );
}

export function base64StringToBuffer(value: string): Uint8Array | null {
  if (value.length === 0) {
    return new Uint8Array();
  }
  if (!isBase64String(value)) {
    return null;
  }
  try {
    // Use the browser implementation of atob
    const base64Decoded = atob(value);
    const buffer = new Uint8Array(base64Decoded.length);
    for (let i = 0; i < base64Decoded.length; i++) {
      buffer[i] = base64Decoded.charCodeAt(i);
    }
    return buffer;
  } catch (_error: unknown) {
    // Use the implementation of Buffer for environments such as node
    return Uint8Array.from(Buffer.from(value, "base64"));
  }
}

export function bufferToBase64String(bytes: Uint8Array): string {
  const g = globalThis as typeof globalThis & {
    Buffer?: typeof Buffer;
    btoa?: (data: string) => string;
  };

  if (typeof g.btoa === "function") {
    // convert bytes to a binary string for btoa
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte === undefined) {
        throw new Error("Unexpected undefined byte in array.");
      }
      binary += String.fromCharCode(byte);
    }
    return g.btoa(binary);
  }

  const Buf = g.Buffer;
  if (typeof Buf !== "undefined") {
    return Buf.from(bytes).toString("base64");
  }

  throw new Error("No Base64 encoder available in this environment.");
}
