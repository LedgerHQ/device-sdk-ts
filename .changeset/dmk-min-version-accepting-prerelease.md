---
"@ledgerhq/device-management-kit": minor
---

Add ApplicationChecker.withMinVersionInclusiveAcceptingPrerelease, a variant of withMinVersionInclusive that strips prerelease and build tags before comparing, so an app reporting a release candidate of the minimum still passes the check
