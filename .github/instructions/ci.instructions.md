---
applyTo: ".github/workflows/**,.github/actions/**,**/Dockerfile,**/docker-entrypoint.sh"
---

# CI workflows, composite actions and Docker files

Focus on:

- **Pipeline breakage:**
  - a job or step that will fail, or a wrong `if:` condition
  - a missing `needs:`, a broken path or trigger filter, a wrong output or env reference
  - an action input that doesn't exist
- **Secret exposure:**
  - a secret printed to logs, or passed to an untrusted action or a `pull_request_target` job running fork code
  - a token with more permissions than the job needs
- **Hardening:**
  - tools downloaded from `latest` or without checksum verification
  - deploy jobs without a protected GitHub Environment
  - containers running as root
  - third-party actions not pinned to a commit SHA
