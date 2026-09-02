# Device Mock Server UI

The web front end of the [device mock server](../device-mock-server). It builds to a static bundle that the server hands out at its **root URL**, so a mock session can be created and configured by clicking instead of by curl.

It is a plain HTTP consumer: everything it does goes through the server's [documented API](../device-mock-server/README.md#-http-api), and nothing it offers is exclusive to the UI.

## 🔹 Index

1. [Screens](#-screens)
2. [Getting started](#-getting-started)
3. [How it reaches the server](#-how-it-reaches-the-server)
4. [Design system](#-design-system)
5. [Structure](#-structure)

## 🔹 Screens

**Landing** — is the server up, and which session are we working in?

- Create a session (`POST /auth`), or paste a token to join one already in use (Ledger Live's, for instance).
- Tokens used before are remembered in `localStorage` and offered as shortcuts; each is checked against the server before the session opens, because a restart wipes them all.
- A short "how it works" explains what a session, a device and a mock are, for a first-time visitor.

**Session** — everything the session owns:

- The **server URL and token** to hand to Ledger Live or a DMK app, plus the session's expiry, and a way to delete it.
- **Devices**: add, edit and remove them (model, name, firmware, connectivity, installed apps, onboarded or not), connect and disconnect them. The firmware field says whether that OS version was ever released for the model, and the app picker lists what the Manager API reports for it — both re-asked, debounced, whenever the model or firmware changes, because an app's version is tied to a firmware version and Speculos cannot open one built for another. The picker leads with the apps DMK ships a signer kit for; the couple of hundred others are behind its search. Each device expands into three tabs:
  - _Overview_ — id, memory mask, onboarding state, installed apps.
  - _Mocks_ — the device's canned APDU replies, with ready-made scenarios (locked device, app not installed, user refusal).
  - _APDU console_ — send any APDU and read the answer with its status word decoded; quick buttons for the handshake, Open App per installed app, Close App, and the onboarding walkthrough for a device that is not onboarded.
- **Save and load**: export the session to JSON and import one back, from a file or pasted.
- **Speculos seed**: the mnemonic the emulator derives from, with the plain-text warning it deserves.

## 🔹 Getting started

Install from the **monorepo root** (`pnpm install`), then:

```bash
# Dev server with hot reload on http://127.0.0.1:9753,
# proxying the API to a mock server on 9752
pnpm dev

# Production bundle into dist/
pnpm build
```

For the built UI, start the mock server instead and open its own port — it finds `dist/` on its own:

```bash
pnpm --filter @ledgerhq/device-mock-server-ui build
pnpm --filter @ledgerhq/device-mock-server serve
# open http://127.0.0.1:9752
```

## 🔹 How it reaches the server

Every request is **same-origin and relative** (`/auth`, `/devices/:id/mocks`, …): in production the mock server serves this bundle itself, so there is no base URL to configure and no CORS to negotiate. In development Vite proxies the same paths to `MOCK_SERVER_URL` (`http://127.0.0.1:9752` by default), which keeps the app identical in both modes.

`src/api/client.ts` is the only place that knows about HTTP. It is a thin `fetch` wrapper — no DMK dependency — that types its payloads with the contract from [`@ledgerhq/device-mockserver-client`](../../packages/mockserver-client) so the UI and the server cannot drift apart, and raises `MockServerError` carrying the status code (a 401 means "that token is gone", not "bad request").

Session state lives on the server; the UI only remembers which token is active. It reloads the session on demand rather than polling, so an idle tab does not keep a session alive forever.

## 🔹 Design system

Built with [Lumen](https://ldls.vercel.app) (`@ledgerhq/lumen-ui-react` + `@ledgerhq/lumen-design-core`), the same design system as Ledger Live Desktop, on Tailwind v4:

- `tailwind.config.ts` applies `ledgerLivePreset`; `src/globals.css` imports Lumen's stylesheet so Tailwind scans the compiled components.
- Only Lumen tokens are used — typography (`heading-4`, `body-3`), colours (`bg-canvas`, `text-muted`, `border-muted`) and the pixel-based spacing/size scale (`p-24` is 24px). No raw Tailwind palette or font utilities.
- The whole app sits under `ThemeProvider colorScheme="system"`, so it follows the OS light/dark preference.

## 🔹 Structure

| Path             | Contents                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `src/api`        | The typed `fetch` client for the mock server, its route list, and the catalog hook.                   |
| `src/pages`      | The two screens: `LandingPage`, `SessionPage`.                                                        |
| `src/components` | The pieces they compose: device card and dialog, mocks panel, APDU console, transfer and seed panels. |
| `src/domain`     | Knowledge with no UI: device models, APDU builders and status words, mock presets, remembered tokens. |
