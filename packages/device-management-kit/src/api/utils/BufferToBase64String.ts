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
