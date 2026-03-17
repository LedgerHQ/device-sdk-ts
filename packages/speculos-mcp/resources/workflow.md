# Speculos Signing Workflow

## Overview

Speculos emulates a Ledger device App.
Signing a transaction or typed data follows a strict review-then-approve lifecycle.

## Workflow Steps

### 0. Check device state

Before starting any signing flow, call `read` to inspect the current screen and verify the device is ready (e.g. the Ethereum app home screen is displayed and no prior flow is pending).

If no speculos is running, call `start_speculos` to launch one automatically in Docker. You can check with `speculos_status`. When done, call `stop_speculos` to clean up.

If `start_speculos` fails, check the following before retrying:

- **Docker not running**: Verify Docker is available by running `docker info` in a shell. If it fails, ask the user to start Docker Desktop or the Docker daemon.
- **`COIN_APPS_PATH` not set**: The environment variable must point to the directory containing Ledger app binaries.
- **Port conflict**: Another process may already be using the Speculos port (default 5000). Check with `get_logs` for details.

Use `get_logs` to inspect the cs-tester output for additional diagnostics.

### 1. Start signing

Call `sign_transaction` or `sign_typed_data`.
This sends the payload to the device and the first review screen appears.

**Tool selection**: Follow the user's exact wording. If they say "transaction", "TX", or provide a raw hex payload, use `sign_transaction`. Only use `sign_typed_data` when the user explicitly says "typed data", "EIP-712", or provides a JSON object with `types`/`primaryType`/`domain`/`message`. Do not guess based on protocol names.

### 1b. Dismiss dialogs before review

After starting the signing flow, the device may show one or more dialogs before the review screens:

- **"Enable transaction check?" dialog**: If the screen shows a "Maybe later" button, call `dismiss_transaction_check` to dismiss it.
- **"Blind signing ahead" warning**: If the screen shows a "Blind signing ahead" warning, the transaction or typed data is not recognized for clear signing. Call `accept_blind_signing` to go back to safety (default). Do NOT pass `accept: true` unless the user explicitly said "blind sign". Report to the user that the transaction cannot be clear-signed.
- **"Blind signing not enabled" block**: If the screen shows "Go to settings" and "Reject transaction", blind signing is disabled in the Ethereum app. Call `enable_blind_signing` to reject the transaction (default). Do NOT pass `enable: true` unless the user explicitly said "blind sign". Report to the user that clear signing failed.

Use `read` to inspect the screen if you are unsure which dialog is shown. These dialogs may appear in sequence (opt-in first, then blind signing warning).

### 2. Review fields

Use `swipe` with direction `next` to advance through the review screens one by one.
Each screen displays one or multiple fields of the transaction:

- **Transaction fields** (typical order): To, Amount, Max Fees, Network
- **EIP-712 fields**: Domain fields, then message fields in declaration order

Use `read` at any time to re-read the current screen without changing it.
Use `swipe` with direction `previous` to go back to a prior field.

### 3. Approve or Reject

The last review screen shows **"Hold to sign"**.

- To approve: call `approve` (long-press the sign button). The device returns a cryptographic signature.
- To reject: call `reject` at any point. The device cancels the signing flow.

### 4. Check result

After approval, the `signing_status` field in the response contains the signature (`status: "completed"`).
If something went wrong, `signing_status` shows `status: "error"` with details.

### 5. Summary table

After the flow is complete (approved, rejected, or aborted), present a summary table with all reviewed fields (Field | Value). Below the table, indicate the signing mode: **Clear signed** or **Blind signed**. Keep it simple.

## Important Notes

- You **must** swipe through all screens before the "Hold to sign" button appears.
- Approving is **irreversible** — the signature is final.
- Only one signing flow can be active at a time.
- Use `get_logs` for debugging if the device or DMK behaves unexpectedly.
