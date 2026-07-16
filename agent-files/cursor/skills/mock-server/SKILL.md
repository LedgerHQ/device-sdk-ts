---
name: mock-server
description: >
  Talk to the DMK device mock server (apps/device-mock-server, default
  http://127.0.0.1:9752) with curl. Make fake devices, connect them, add APDU
  mocks, send APDUs, break commands on purpose. ALWAYS read this skill when the
  user says "mock server", makes/changes a mock device, adds mocks, forces an
  APDU error, or pokes a device Ledger Live/DMK is on.
---

# Mock server

Fake Ledger devices over REST. You do curl. Server hands back JSON.

Big book of every route: `apps/device-mock-server/openapi.yaml`. Read it when
this file is not enough.

## Rules to remember

- URL is `http://127.0.0.1:9752`.
- Every call needs `Authorization: Bearer <token>`. Only `POST /auth` and
  `GET /health` go free.
- Get token: `POST /auth`. Or steal the one Ledger Live/DMK uses.
- Curl to `127.0.0.1` needs `required_permissions: ["all"]`.
- Server forgets everything on restart. No disk.

Set once per shell:

```bash
BASE=http://127.0.0.1:9752
TOKEN=<bearer-token>
AUTH="Authorization: Bearer $TOKEN"
JSON="Content-Type: application/json"
```

## Client device (Ledger Live / DMK)

Client makes its own device when it connects. To touch it:

- Ask user for the FULL token. Logs show only first 8 letters.
- Find device with `GET /devices`. Change it with `PATCH`.
- NEVER delete then remake it. New id = client lost forever.

## The curl commands

```bash
# Token + health
curl -s -X POST $BASE/auth                                   # -> { token, expires_at }
curl -s $BASE/health

# Devices
curl -s $BASE/devices -H "$AUTH"
curl -s $BASE/devices/<id> -H "$AUTH"
curl -s -X POST $BASE/devices -H "$AUTH" -H "$JSON" \
  -d '{"name":"Ledger Flex","device_type":"flex","firmware_version":"1.9.1"}'
curl -s -X PATCH $BASE/devices/<id> -H "$AUTH" -H "$JSON" \
  -d '{"firmware_version":"1.10.0"}'
curl -s -X DELETE $BASE/devices/<id> -H "$AUTH"

# Plug / unplug
curl -s -X POST $BASE/devices/<id>/connect -H "$AUTH"        # or /disconnect

# Send APDU
curl -s -X POST $BASE/devices/<id>/apdu -H "$AUTH" -H "$JSON" -d '{"apdu":"e001000000"}'

# Mocks
curl -s $BASE/devices/<id>/mocks -H "$AUTH"
curl -s -X POST $BASE/devices/<id>/mocks -H "$AUTH" -H "$JSON" -d '{"prefix":"b001","response":"5515"}'
curl -s -X PATCH $BASE/devices/<id>/mocks/<mockId> -H "$AUTH" -H "$JSON" -d '{"prefix":"b001","response":"9000"}'
curl -s -X DELETE $BASE/devices/<id>/mocks/<mockId> -H "$AUTH"
curl -s -X DELETE $BASE/devices/<id>/mocks -H "$AUTH"        # kill all

# Save / load session
curl -s $BASE/export -H "$AUTH"
curl -s -X POST $BASE/import -H "$AUTH" -H "$JSON" -d '<SessionExport json>'
```

`device_type`: `nanoS`, `nanoSP`, `nanoX`, `stax`, `flex`, `apexp`. `PATCH` keeps
the id and only changes fields you send.

## Mocks: how they work

- Mock catches any APDU that STARTS WITH `prefix`.
- One `response`, or a list `responses` (used one by one, then loops).
- Longest prefix wins. Newest wins ties. Mock beats the server's own answer.
- Answer = `<data><status>`. `9000` = ok. `6d00` = no/unknown. `5515` = locked.

```bash
# Say device is locked:
curl -s -X POST $BASE/devices/<id>/mocks -H "$AUTH" -H "$JSON" -d '{"prefix":"b001","response":"5515"}'

# Break a command on purpose:
curl -s -X POST $BASE/devices/<id>/mocks -H "$AUTH" -H "$JSON" -d '{"prefix":"e00300","response":"6d00"}'

# Ok, ok, then fail, on repeat:
curl -s -X POST $BASE/devices/<id>/mocks -H "$AUTH" -H "$JSON" \
  -d '{"prefix":"e0aa0000","responses":["cafe9000","cafe9000","6d00"]}'
```

Add mock = new behavior. Delete mock = old behavior back.

## Onboarding

Make a fresh, not-onboarded device and walk it through Ledger Live's
SyncOnboarding steps. Ask for `onboarded: false` at create time (omit it, or
`true`, for a normal onboarded device):

```bash
curl -s -X POST $BASE/devices -H "$AUTH" -H "$JSON" \
  -d '{"name":"Ledger Nano X","device_type":"nanoX","firmware_version":"1.3.0","onboarded":false}'
```

State lives in the GetOsVersion (`e001000000`) answer's `seFlags`: byte 0 has
the onboarded bit, byte 3 the step. Poll `e001000000` to read it and to move
the flow along.

- Starts at WELCOME (step `00`), not onboarded. Dwells here until you send
  `e0030000` (enter early check).
- Now at EARLY_CHECK (step `0f`). Dwells here until you send `e0030001`
  (exit early check).
- After exit, each `e001000000` poll auto-advances one step:
  ChooseName `0c` -> Pin `06` -> SetupChoice `05` -> NewDevice `07` ->
  NewDeviceConfirming `08` -> SafetyWarning `0a` -> Ready `0b`.
- At Ready, byte 0 flips to `e6` (onboarded set) and `GET /devices/<id>` now
  says `onboarded: true`.

```bash
# Walk it: enter, exit, then poll until Ready.
curl -s -X POST $BASE/devices/<id>/apdu -H "$AUTH" -H "$JSON" -d '{"apdu":"e0030000"}'  # enter early check
curl -s -X POST $BASE/devices/<id>/apdu -H "$AUTH" -H "$JSON" -d '{"apdu":"e0030001"}'  # exit early check
curl -s -X POST $BASE/devices/<id>/apdu -H "$AUTH" -H "$JSON" -d '{"apdu":"e001000000"}' # poll (repeat to advance)
```

## Newest firmware

Server has no "latest" list. Read the real version from Ledger, then `PATCH`:

- Page: https://support.ledger.com/article/7103926130845-zd (Stax, Flex,
  Nano Gen5, Nano X, Nano S Plus).
- Read the page fresh each time. Numbers change.

## Touch the screen (Speculos)

Some APDUs wait for a screen tap (e.g. Web3 Check `e032010000` on Ethereum).
No tap = hang until timeout (`6d00`). Tap while APDU is flying:

```bash
# Stax 400x672: accept = x=200,y=537 ; reject = x=200,y=604
curl -s -X POST $BASE/devices/<id>/speculos/finger -H "$AUTH" -H "$JSON" \
  -d '{"action":"press-and-release","x":200,"y":537}'
```
