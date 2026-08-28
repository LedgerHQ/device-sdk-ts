import { Maybe } from "purify-ts";
import { vi } from "vitest";

import { OsApduService } from "@internal/os/service/OsApduService";
import { type FirmwareUpdateResolver } from "@internal/secure-channel/service/FirmwareUpdateResolver";
import { InMemorySessionRepository } from "@internal/session/data/InMemorySessionRepository";
import { type SessionRecord } from "@internal/session/model/SessionModels";

const GET_OS_VERSION = "e001000000";
const EARLY_CHECK_ENTER = "e0030000";
const EARLY_CHECK_EXIT = "e0030001";
// Same cla+ins+p1 as the early-check toggle, but not one of its two p2 values.
const OTHER_E003 = "e0030002";
// How the toggle actually arrives from a transport: p2 followed by Lc = 00.
const EARLY_CHECK_ENTER_WITH_LC = "e003000000";

const firmwareResolver: FirmwareUpdateResolver = {
  resolveNextVersion: vi.fn().mockResolvedValue(Maybe.empty()),
  resolveCurrentMcuVersion: vi.fn().mockResolvedValue(Maybe.of("2.30")),
} as unknown as FirmwareUpdateResolver;

const setup = (onboarded?: boolean) => {
  const repo = new InMemorySessionRepository({});
  const { token } = repo.createSession();
  const record = repo.findByToken(token).unsafeCoerce() as SessionRecord;
  const device = repo.addDevice(record, {
    device_type: "nanoX",
    firmware_version: "1.3.0",
    onboarded,
  });
  const os = new OsApduService(repo, firmwareResolver);
  return { repo, record, device, os };
};

/**
 * Extracts the 4-byte `seFlags` (hex) from a synthesized GetOsVersion response.
 * Layout: targetId (4 bytes) + seVersion LV + seFlags LV (len byte `04` + flags).
 * With seVersion "1.3.0" (5 bytes) the flags are a fixed slice.
 */
const seFlagsOf = (response: string): string => response.slice(22, 30);

describe("OsApduService onboarding", () => {
  it("reports a normal onboarded device when not simulating onboarding", async () => {
    const { os, record, device } = setup();
    const response = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(response!)).toBe("e6000000");
  });

  it("reports not-onboarded WELCOME and dwells until the early-check enter", async () => {
    const { os, record, device } = setup(false);

    const first = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(first!)).toBe("00000000");

    // WELCOME does not auto-advance: another poll stays at WELCOME.
    const second = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(second!)).toBe("00000000");
  });

  it("enters and dwells on the early-security-check step until exit", async () => {
    const { os, record, device } = setup(false);
    await os.resolve(record, device, GET_OS_VERSION); // WELCOME

    expect(await os.resolve(record, device, EARLY_CHECK_ENTER)).toBe("9000");

    const early = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(early!)).toBe("0000000f");

    // EARLY_CHECK dwells until the exit APDU.
    const stillEarly = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(stillEarly!)).toBe("0000000f");
  });

  it("walks to READY and flips the onboarded bit after the exit", async () => {
    const { os, repo, record, device } = setup(false);
    await os.resolve(record, device, GET_OS_VERSION); // WELCOME
    await os.resolve(record, device, EARLY_CHECK_ENTER);
    await os.resolve(record, device, GET_OS_VERSION); // EARLY_CHECK
    expect(await os.resolve(record, device, EARLY_CHECK_EXIT)).toBe("9000");

    const walkedSteps: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const response = await os.resolve(record, device, GET_OS_VERSION);
      walkedSteps.push(seFlagsOf(response!));
    }

    expect(walkedSteps).toEqual([
      "0000000c", // CHOOSE_NAME
      "00000006", // PIN
      "00000005", // SETUP_CHOICE
      "00000007", // NEW_DEVICE
      "00000008", // NEW_DEVICE_CONFIRMING
      "0000000a", // SAFETY_WARNING
      "e600000b", // READY, onboarded
    ]);

    // The device metadata reflects completion.
    expect(repo.findDevice(record, device.id).unsafeCoerce().onboarded).toBe(
      true,
    );
  });

  it("leaves an unrelated e003 APDU alone while onboarding", async () => {
    const { os, record, device } = setup(false);
    await os.resolve(record, device, GET_OS_VERSION); // WELCOME

    // Not the early-check command: it falls through rather than being
    // acknowledged, and the onboarding step is untouched.
    expect(await os.resolve(record, device, OTHER_E003)).toBeUndefined();
    const still = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(still!)).toBe("00000000");
  });

  it("handles the toggle as it arrives on the wire, with its Lc byte", async () => {
    const { os, record, device } = setup(false);
    await os.resolve(record, device, GET_OS_VERSION); // WELCOME

    expect(await os.resolve(record, device, EARLY_CHECK_ENTER_WITH_LC)).toBe(
      "9000",
    );
    const early = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(early!)).toBe("0000000f");
  });

  it("restarts the walk when a completed device is set back to not onboarded", async () => {
    const { os, repo, record, device } = setup(false);
    await os.resolve(record, device, GET_OS_VERSION);
    await os.resolve(record, device, EARLY_CHECK_ENTER);
    await os.resolve(record, device, GET_OS_VERSION);
    await os.resolve(record, device, EARLY_CHECK_EXIT);
    for (let i = 0; i < 7; i += 1) {
      await os.resolve(record, device, GET_OS_VERSION);
    }
    const ready = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(ready!)).toBe("e600000b");

    // Asking for a not-onboarded device again walks it from WELCOME, rather
    // than leaving the finished simulation reporting itself onboarded.
    const reset = repo
      .editDevice(record, device.id, { onboarded: false })
      .unsafeCoerce();
    expect(reset.onboarded).toBe(false);
    const welcome = await os.resolve(record, reset, GET_OS_VERSION);
    expect(seFlagsOf(welcome!)).toBe("00000000");
  });

  it("keeps a walk in progress where it is when the device is edited", async () => {
    const { os, repo, record, device } = setup(false);
    await os.resolve(record, device, GET_OS_VERSION);
    await os.resolve(record, device, EARLY_CHECK_ENTER);
    const early = await os.resolve(record, device, GET_OS_VERSION);
    expect(seFlagsOf(early!)).toBe("0000000f");

    const edited = repo
      .editDevice(record, device.id, { onboarded: false, name: "Renamed" })
      .unsafeCoerce();

    const stillEarly = await os.resolve(record, edited, GET_OS_VERSION);
    expect(seFlagsOf(stillEarly!)).toBe("0000000f");
  });

  it("does not intercept the early-check APDU outside onboarding", async () => {
    const { os, record, device } = setup();
    // Not onboarding: e003 is not a derived OS response, so it falls through.
    expect(await os.resolve(record, device, EARLY_CHECK_ENTER)).toBeUndefined();
  });
});
