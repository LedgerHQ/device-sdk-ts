---
"@ledgerhq/device-management-kit": patch
---

Fix React Native Manager API requests failing with HTTP 400 because the last query parameter value was suffixed with a stray `/` (e.g. `provider=1/`). `DmkNetworkClient` now builds and sends the request URL as a plain string instead of round-tripping through `URL`/`URL.toString()`, which corrupted URLs with a query string on affected React Native versions (facebook/react-native#54242).
