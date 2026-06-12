---
"@ledgerhq/device-management-kit": minor
---

Remove request `signal` support and the now-unused `isAbort` error field from `DmkNetworkClient`, implement portable timeout handling with `AbortController`, and remove Node `url` usage from secure-channel WebSocket URL formatting.

Make the Base64 helpers (`base64StringToBuffer`, `bufferToBase64String`, `isBase64String`) portable across runtimes: prefer `window.atob`/`window.btoa` in browsers, fall back to the global `atob`/`btoa` (e.g. Hermes) and then to `Buffer` (Node). Decoding and validation now tolerate MIME-style whitespace (e.g. line breaks), so Base64 emitted by native encoders decodes correctly.
