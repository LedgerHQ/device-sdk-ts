---
"@ledgerhq/device-management-kit-devtools-core": minor
"@ledgerhq/device-management-kit-devtools-ui": minor
"@ledgerhq/device-management-kit-devtools-rozenite": minor
---

Add DevToolsDmkInspector for device session inspection and control

**devtools-core:**
- New `DevToolsDmkInspector` module enabling bi-directional communication between client app and dashboard
- Device discovery: passive listening and active discovery from the dashboard
- Device session actions: disconnect sessions, send raw APDU commands
- DMK configuration: view and set Manager API provider
- Exports command types and message types for type-safe communication

**devtools-ui:**
- New Inspector screen with device sessions list and live state updates
- Device discovery UI with listening/discovering controls
- APDU sender for debugging raw device communication
- Split view mode to display Logger and Inspector side-by-side with draggable divider
- Debug drawer for raw message inspection
- Navigation bar with tabs for Logger, Inspector, and split modes

**devtools-rozenite:**
- Fix bidirectional handshake to ensure messages flow correctly regardless of initialization order
