/**
 * E2E: run ContactsManager.registerExternalAddress() against a REAL device.
 *
 * This performs a genuine contact registration — the device will prompt you to
 * confirm on-screen, and on success returns the group handle + HMAC proofs.
 *
 * Requires: Flex on USB, unlocked, with the (Address-Book-enabled) Ethereum app OPEN.
 * Run:  cd apps/ldmk-cli && npx tsx register-external-address-e2e.ts
 */
import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
} from "@ledgerhq/device-management-kit";
import { ContactsManagerBuilder } from "@ledgerhq/device-contacts-kit";
import { nodeHidTransportFactory } from "@ledgerhq/device-transport-kit-node-hid";
import { filter, firstValueFrom, map, timeout } from "rxjs";

const toHex = (a: Uint8Array) =>
  Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const hexToBytes = (h: string) =>
  Uint8Array.from(h.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

// A valid new-group registration (example first-account Ethereum address).
const INPUT = {
  contactName: "Alice",
  scope: "Eth main",
  identifier: hexToBytes("de0b295669a9fd93d5f28d9ec85e40f4cb697bae"), // 20 bytes
  blockchainFamily: "ethereum",
  chainId: 1n,
  skipOpenApp: false, // start on the dashboard; let the flow open the app
};

async function main() {
  const dmk = new DeviceManagementKitBuilder()
    .addTransport(nodeHidTransportFactory)
    .build();

  console.log("🔎 Discovering a USB device (15s)…");
  const device = await firstValueFrom(
    dmk.listenToAvailableDevices({}).pipe(
      filter((d) => d.length > 0),
      map((d) => d[0]!),
      timeout(15_000),
    ),
  );
  const sessionId = await dmk.connect({ device });
  console.log(`🔗 Connected to ${device.name} (session ${sessionId})`);

  // Wait until the session state carries the OS version the guard needs. This
  // is read on the dashboard, so the device must start on the home screen.
  console.log("⏳ Waiting for the OS version to populate (dashboard read)…");
  const st = await firstValueFrom(
    dmk.getDeviceSessionState({ sessionId }).pipe(
      filter(
        (s: any) =>
          s?.deviceModelId !== undefined && s?.firmwareVersion?.os !== undefined,
      ),
      timeout(25_000),
    ),
  ).catch(() => undefined);
  const s: any = st ?? {};
  console.log("🩺 session state:", {
    sessionStateType: s.sessionStateType,
    deviceModelId: s.deviceModelId,
    os: s.firmwareVersion?.os,
    currentApp: s.currentApp,
  });
  if (s.firmwareVersion?.os === undefined) {
    console.log(
      "⚠️  OS version still not populated — make sure the Flex is on the HOME dashboard (quit any open app), then re-run.",
    );
  }

  const contacts = new ContactsManagerBuilder({
    dmk,
    sessionId,
    appName: "Ethereum",
  }).build();

  console.log("📝 registerExternalAddress:", {
    ...INPUT,
    identifier: toHex(INPUT.identifier),
    chainId: INPUT.chainId.toString(),
  });

  const { observable } = contacts.registerExternalAddress(INPUT);

  await new Promise<void>((resolve, reject) => {
    observable.subscribe({
      next: (state) => {
        if (state.status === DeviceActionStatus.Pending) {
          const ui = state.intermediateValue?.requiredUserInteraction;
          console.log(`   … pending — interaction: ${ui}`);
          if (ui === "register-wallet") {
            console.log(
              "   👉 CONFIRM THE REGISTRATION ON YOUR FLEX NOW (approve on device).",
            );
          }
        } else if (state.status === DeviceActionStatus.Completed) {
          const o = state.output;
          console.log("\n✅ COMPLETED — registration succeeded:");
          console.log("   mode:            ", o.mode);
          console.log("   contactName:     ", o.contactName);
          console.log("   scope:           ", o.scope);
          console.log("   blockchainFamily:", o.blockchainFamily);
          console.log("   chainId:         ", o.chainId?.toString());
          console.log("   identifier:      ", toHex(o.identifier));
          console.log(
            `   groupHandle (${o.groupHandle.length}B): ${toHex(o.groupHandle)}`,
          );
          console.log(
            `   hmacProof   (${o.hmacProof.length}B): ${toHex(o.hmacProof)}`,
          );
          console.log(
            `   hmacRest    (${o.hmacRest.length}B): ${toHex(o.hmacRest)}`,
          );
        } else if (state.status === DeviceActionStatus.Error) {
          console.log("\n❌ ERROR state:", JSON.stringify(state.error));
        }
      },
      error: reject,
      complete: resolve,
    });
  });

  process.exit(0);
}

main().catch((e) => {
  console.error("💥 E2E failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
