/**
 * Throwaway QA probe: does the currently-open embedded app recognize the
 * Contacts (Address Book) APDUs?
 *
 * Sends the register-identity header — CLA 0xB0, INS 0x10, P1 0x01, P2 0x00 —
 * and prints the status word.
 *   - 0x6E00 / 0x6D00  → CLA/INS not supported → NO address book in this build
 *                        (the Ethereum app must be sideloaded with ENABLE_ADDRESS_BOOK)
 *   - anything else    → the app handled it → address book is present
 *
 * Requires: a Flex connected over USB, unlocked, with the Ethereum app OPEN.
 * Run:  cd apps/ldmk-cli && npx tsx probe-contacts.ts
 */
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import { nodeHidTransportFactory } from "@ledgerhq/device-transport-kit-node-hid";
import { filter, firstValueFrom, map, timeout } from "rxjs";

const toHex = (a: Uint8Array) =>
  Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function main() {
  const dmk = new DeviceManagementKitBuilder()
    .addTransport(nodeHidTransportFactory)
    .build();

  console.log("🔎 Discovering a USB device (15s)…");
  const device = await firstValueFrom(
    dmk.listenToAvailableDevices({}).pipe(
      filter((devices) => devices.length > 0),
      map((devices) => devices[0]!),
      timeout(15_000),
    ),
  );
  console.log(`📟 Found: ${device.name ?? "(unnamed)"} [${device.modelId}]`);

  const sessionId = await dmk.connect({ device });
  console.log(`🔗 Connected (session ${sessionId})`);

  // Confirm which app is actually open: standard get-app-and-version (B0 01 00 00).
  // Response: format(1) | nameLen(1) | name | versionLen(1) | version | SW.
  const info = await dmk.sendApdu({
    sessionId,
    apdu: Uint8Array.from([0xb0, 0x01, 0x00, 0x00]),
  });
  const infoSw = toHex(info.statusCode);
  if (infoSw === "9000" && info.data.length > 2) {
    const nameLen = info.data[1]!;
    const name = Buffer.from(info.data.slice(2, 2 + nameLen)).toString();
    const verLen = info.data[2 + nameLen]!;
    const version = Buffer.from(
      info.data.slice(3 + nameLen, 3 + nameLen + verLen),
    ).toString();
    console.log(`📲 Open app: "${name}" v${version} (B0 01 → 9000)`);
  } else {
    console.log(`📲 get-app-and-version → SW=${infoSw} (couldn't read app)`);
  }

  // Probe 1 — bare register-identity header (B0 10 01 00). A 6E00/6D00 here
  // means the instruction is unknown; a length error (6C00/6700) means it IS
  // recognized but wants a framed body.
  const bare = Uint8Array.from([0xb0, 0x10, 0x01, 0x00]);
  console.log(`➡️  Probe 1 (bare header): ${toHex(bare)}`);
  const r1 = await dmk.sendApdu({ sessionId, apdu: bare });
  console.log(`⬅️  SW=${toHex(r1.statusCode)}`);

  // Probe 2 — a properly framed FIRST chunk (P2=0x00) declaring a 0-length TLV
  // payload: B0 10 01 00 | Lc=02 | total_length=0x0000. A contacts-aware app
  // parses the (empty) frame and rejects it at validation (e.g. 6A80) BEFORE
  // any on-device UI — non-destructive. A non-contacts app still says 6E00/6D00.
  const framed = Uint8Array.from([0xb0, 0x10, 0x01, 0x00, 0x02, 0x00, 0x00]);
  console.log(`➡️  Probe 2 (framed, empty payload): ${toHex(framed)}`);
  const resp = await dmk.sendApdu({ sessionId, apdu: framed });

  const sw = toHex(resp.statusCode);
  console.log(`⬅️  SW=${sw}  data=${toHex(resp.data) || "(none)"}`);
  if (sw === "6c00" || sw === "6700") {
    console.log(
      `✅ Recognized (SW=${sw}, length error) — the app dispatched the Contacts instruction. Address Book is present.`,
    );
  } else if (sw === "5515") {
    console.log(
      "🔒 Device is LOCKED (SW 5515). Enter your PIN, open the Ethereum app, then re-run. (Inconclusive.)",
    );
  } else if (sw === "6511" || sw === "6e01") {
    console.log(
      "🏠 No app open (SW " +
        sw +
        "). Open the Ethereum app on the device, then re-run. (Inconclusive.)",
    );
  } else if (sw === "6e00" || sw === "6d00") {
    console.log(
      "❌ NOT recognized (SW " +
        sw +
        ") — this app has no Address Book. You must sideload the ENABLE_ADDRESS_BOOK build.",
    );
  } else if (sw === "9000" || sw.startsWith("6a") || sw.startsWith("69")) {
    console.log(
      `✅ Recognized (SW=${sw}) — the app handled the Contacts CLA/INS. Address Book is present.`,
    );
  } else {
    console.log(
      `❓ Unexpected SW=${sw} — inconclusive; make sure the Ethereum app is open and unlocked, then re-run.`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("💥 Probe failed:", e instanceof Error ? e.message : e);
  console.error(
    "   Is the Flex connected over USB, unlocked, with the Ethereum app OPEN?",
  );
  process.exit(1);
});
