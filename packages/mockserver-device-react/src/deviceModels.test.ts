import { findDeviceScreenModel } from "./deviceModels";

describe("findDeviceScreenModel", () => {
  it("finds a model by the mock server's device type", () => {
    expect(findDeviceScreenModel("stax")).toMatchObject({
      label: "Stax",
      touch: true,
      speculos: true,
    });
  });

  it("marks Nano S as having no emulator", () => {
    expect(findDeviceScreenModel("nanoS").speculos).toBe(false);
  });

  it("falls back to a button-driven model for an unknown type", () => {
    expect(findDeviceScreenModel("unknown")).toMatchObject({
      label: "Device",
      touch: false,
    });
  });
});
