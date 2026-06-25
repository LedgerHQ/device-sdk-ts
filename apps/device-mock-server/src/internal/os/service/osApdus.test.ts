import { type Device } from "@ledgerhq/device-mockserver-client";

import {
  deriveGetAppAndVersion,
  deriveGetBatteryStatus,
  deriveGetOsVersion,
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

  it("returns undefined for a non-OS APDU", () => {
    expect(deriveOsApduResponse(device({}), "e0f1000000")).toBeUndefined();
  });
});
