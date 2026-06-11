export function isBase64String(value: string): boolean {
  // Valid base64 characters are [A-Za-z0-9+/]
  // They are always grouped by 4 characters.
  // Optional padding at the end with one or two '='.
  // see section 4 of: https://www.rfc-editor.org/rfc/rfc4648.txt
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    value,
  );
}

/**
 * Prefer `window.atob` in browser runtimes where Base64 helpers are exposed on
 * `window`; fall back to global `atob` for runtimes such as Hermes.
 */
function getAtob(): ((data: string) => string) | undefined {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob.bind(window);
  }
  // eslint-disable-next-line no-restricted-globals
  if (typeof atob === "function") {
    // eslint-disable-next-line no-restricted-globals
    return atob;
  }
  return undefined;
}

/**
 * Prefer `window.btoa` in browser runtimes where Base64 helpers are exposed on
 * `window`; fall back to global `btoa` for runtimes such as Hermes.
 */
function getBtoa(): ((data: string) => string) | undefined {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa.bind(window);
  }
  // eslint-disable-next-line no-restricted-globals
  if (typeof btoa === "function") {
    // eslint-disable-next-line no-restricted-globals
    return btoa;
  }
  return undefined;
}

export function base64StringToBuffer(value: string): Uint8Array | null {
  if (value.length === 0) {
    return new Uint8Array();
  }
  if (!isBase64String(value)) {
    return null;
  }
  const atobFn = getAtob();

  if (atobFn) {
    const base64Decoded = atobFn(value);
    const buffer = new Uint8Array(base64Decoded.length);
    for (let i = 0; i < base64Decoded.length; i++) {
      buffer[i] = base64Decoded.charCodeAt(i);
    }
    return buffer;
  }

  if (typeof globalThis.Buffer !== "undefined") {
    return Uint8Array.from(globalThis.Buffer.from(value, "base64"));
  }

  throw new Error("No Base64 decoder available in this environment.");
}

export function bufferToBase64String(bytes: Uint8Array): string {
  const btoaFn = getBtoa();

  if (btoaFn) {
    // convert bytes to a binary string for btoa
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte === undefined) {
        throw new Error("Unexpected undefined byte in array.");
      }
      binary += String.fromCharCode(byte);
    }
    return btoaFn(binary);
  }

  if (typeof globalThis.Buffer !== "undefined") {
    return globalThis.Buffer.from(bytes).toString("base64");
  }

  throw new Error("No Base64 encoder available in this environment.");
}
