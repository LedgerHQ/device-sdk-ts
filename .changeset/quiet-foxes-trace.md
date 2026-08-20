---
"@ledgerhq/device-management-kit": patch
---

Contacts chunked-framing helper (`sendFramedContactsPayload`) gains optional `logger` + `commandTag` args. When supplied, the helper emits one debug entry per outgoing chunk (chunk index/total, P2, payload length) tagged with the caller-supplied Command name. Backward-compatible — existing call sites unchanged.
