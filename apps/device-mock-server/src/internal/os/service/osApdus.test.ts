import { type Device } from "@ledgerhq/device-mockserver-client";

import {
  deriveCustomLockScreen,
  deriveGetAppAndVersion,
  deriveGetBatteryStatus,
  deriveGetDeviceName,
  deriveGetOsVersion,
  deriveListApps,
  deriveOsApduResponse,
} from "./osApdus";

const device = (overrides: Partial<Device>): Device => ({
  id: "d1",
  name: "Device",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  ...overrides,
});

describe("deriveGetOsVersion", () => {
  it("reproduces the Nano X 2.2.3 reference response", () => {
    // This is exactly the previously-hardcoded default mock.
    expect(deriveGetOsVersion(device({ device_type: "nanoX" }))).toBe(
      "3300000405322e322e3304e600000004322e333004312e31360100010001009000",
    );
  });

  it("derives the target id from the device model", () => {
    expect(
      deriveGetOsVersion(
        device({ device_type: "stax", firmware_version: "1.3.0" }),
      ),
    ).toMatch(/^33200004/);
    expect(
      deriveGetOsVersion(
        device({ device_type: "nanoSP", firmware_version: "1.1.1" }),
      ),
    ).toMatch(/^33100004/);
  });

  it("omits hardware/recover fields per the model+version support matrix", () => {
    // Stax 1.3.0: recover requires >= 1.4.0, hw is Nano X only -> neither field.
    // targetId + LV(1.3.0) + LV(seFlags) + LV(mcuSeph) + LV(mcuBoot) + LV(langId) + 9000
    expect(
      deriveGetOsVersion(
        device({ device_type: "stax", firmware_version: "1.3.0" }),
      ),
    ).toBe("3320000405312e332e3004e600000004322e333004312e31360100" + "9000");
  });

  it("returns undefined for an unsupported model", () => {
    expect(
      deriveGetOsVersion(device({ device_type: "blue", masks: undefined })),
    ).toBeUndefined();
  });

  it("honours an explicit mask override", () => {
    expect(
      deriveGetOsVersion(
        device({ device_type: "unknown", masks: [0x33000000] }),
      ),
    ).toMatch(/^33000004/);
  });
});

describe("deriveGetAppAndVersion", () => {
  it("returns BOLOS with the device firmware version", () => {
    // 01 | 05 "BOLOS" | 05 "2.2.3" | 9000
    expect(deriveGetAppAndVersion(device({ firmware_version: "2.2.3" }))).toBe(
      "0105424f4c4f5305322e322e339000",
    );
  });
});

describe("deriveGetBatteryStatus", () => {
  const percentageApdu = "e010000000";

  it("returns 100% for Stax BATTERY_PERCENTAGE", () => {
    expect(
      deriveGetBatteryStatus(
        device({ device_type: "stax", firmware_version: "1.9.1" }),
        percentageApdu,
      ),
    ).toBe("649000");
  });

  it("returns undefined for models without a battery", () => {
    expect(
      deriveGetBatteryStatus(
        device({ device_type: "nanoS", firmware_version: "1.9.1" }),
        percentageApdu,
      ),
    ).toBeUndefined();
    expect(
      deriveGetBatteryStatus(
        device({ device_type: "nanoX", firmware_version: "2.2.3" }),
        percentageApdu,
      ),
    ).toBeUndefined();
  });
});

describe("deriveGetDeviceName", () => {
  it("encodes the device name as UTF-8 bytes followed by a success SW", () => {
    // "Ledger" = 4c 65 64 67 65 72
    expect(deriveGetDeviceName(device({ name: "Ledger" }))).toBe(
      "4c6564676572" + "9000",
    );
  });

  it("returns a bare success for an empty name", () => {
    expect(deriveGetDeviceName(device({ name: "" }))).toBe("9000");
  });
});

describe("deriveOsApduResponse", () => {
  it("dispatches GetOsVersion (0xE0 0x01)", () => {
    expect(
      deriveOsApduResponse(device({ device_type: "nanoX" }), "e0010000"),
    ).toBe(
      "3300000405322e322e3304e600000004322e333004312e31360100010001009000",
    );
  });

  it("dispatches GetAppAndVersion (0xB0 0x01)", () => {
    expect(
      deriveOsApduResponse(device({ firmware_version: "2.2.3" }), "b0010000"),
    ).toBe("0105424f4c4f5305322e322e339000");
  });

  it("dispatches GetBatteryStatus (0xE0 0x10)", () => {
    expect(
      deriveOsApduResponse(
        device({ device_type: "stax", firmware_version: "1.9.1" }),
        "e010000000",
      ),
    ).toBe("649000");
  });

  it("dispatches the GetDeviceName cleaning APDU (0xE0 0x50) as a bare success", () => {
    expect(deriveOsApduResponse(device({}), "e0500000")).toBe("9000");
  });

  it("dispatches GetDeviceName (0xE0 0xD2)", () => {
    expect(deriveOsApduResponse(device({ name: "Ledger" }), "e0d20000")).toBe(
      "4c6564676572" + "9000",
    );
  });

  it("returns undefined for a non-OS APDU", () => {
    expect(deriveOsApduResponse(device({}), "e0f1000000")).toBeUndefined();
  });

  it("dispatches ListApps (0xE0 0xDE)", () => {
    expect(
      deriveOsApduResponse(
        device({ apps: [{ name: "BOLOS", version: "1.5.0" }] }),
        "e0de000000",
      ),
    ).toBe("9000");
  });

  it("dispatches GetBackgroundImageSize (0xE0 0x64) as an empty device", () => {
    expect(deriveOsApduResponse(device({}), "e064000000")).toBe("000000009000");
  });
});

describe("deriveCustomLockScreen", () => {
  it("reports no image for GetBackgroundImageSize (0xE0 0x64) with size 0", () => {
    expect(deriveCustomLockScreen("e064000000")).toBe("000000009000");
  });

  it("reports no image (662e) for FetchBackgroundImageChunk (0xE0 0x65)", () => {
    expect(deriveCustomLockScreen("e0650000050000000005")).toBe("662e");
  });

  it("reports no image (662e) for GetBackgroundImageHash (0xE0 0x66)", () => {
    expect(deriveCustomLockScreen("e066000000")).toBe("662e");
  });

  it("reports nothing to delete (662e) for DeleteBackgroundImage (0xE0 0x63)", () => {
    expect(deriveCustomLockScreen("e063000000")).toBe("662e");
  });

  it("succeeds for CreateBackgroundImage (0xE0 0x60)", () => {
    expect(deriveCustomLockScreen("e06000000400001000")).toBe("9000");
  });

  it("succeeds for UploadBackgroundImageChunk (0xE0 0x61)", () => {
    expect(deriveCustomLockScreen("e0610000050000000000")).toBe("9000");
  });

  it("succeeds for CommitBackgroundImage (0xE0 0x62)", () => {
    expect(deriveCustomLockScreen("e062000000")).toBe("9000");
  });

  it("returns undefined for a non-CLS APDU", () => {
    expect(deriveCustomLockScreen("e0010000")).toBeUndefined();
    expect(deriveCustomLockScreen("e0f1000000")).toBeUndefined();
  });
});

describe("deriveListApps", () => {
  it("encodes the installed apps (excluding BOLOS) for the initial command", () => {
    const response = deriveListApps(
      device({
        apps: [
          { name: "BOLOS", version: "1.5.0" },
          { name: "Bitcoin", version: "2.1.0" },
        ],
      }),
      "e0de000000",
    );
    // 01 (format byte) + 4c (entry length) + 0001 (blocks) + 0000 (flags)
    // + 32-byte code hash + 32-byte full hash + 07"Bitcoin" + 9000.
    expect(response).toBe(
      "014c00010000" + "0".repeat(128) + "07426974636f696e" + "9000",
    );
  });

  it("returns a bare success when only BOLOS is installed", () => {
    expect(
      deriveListApps(
        device({ apps: [{ name: "BOLOS", version: "1.5.0" }] }),
        "e0de000000",
      ),
    ).toBe("9000");
  });

  it("returns a bare success for the continue command", () => {
    expect(
      deriveListApps(
        device({ apps: [{ name: "Bitcoin", version: "2.1.0" }] }),
        "e0df000000",
      ),
    ).toBe("9000");
  });

  it("returns undefined for an unrelated APDU", () => {
    expect(deriveListApps(device({}), "e0010000")).toBeUndefined();
  });
});
