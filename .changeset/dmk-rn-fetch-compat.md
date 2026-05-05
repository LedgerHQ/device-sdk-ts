---
"@ledgerhq/device-management-kit": patch
---

Fix React Native compatibility in `DmkNetworkClient`: serialize query params manually instead of using `URLSearchParams.set` (not implemented in React Native), and guard optional Web globals (`Blob`, `FormData`, `URLSearchParams`, `ReadableStream`) in `isRawBody` to avoid `ReferenceError` on runtimes where they are missing.
