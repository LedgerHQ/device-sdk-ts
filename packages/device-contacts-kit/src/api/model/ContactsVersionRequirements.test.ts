import { DeviceModelId } from "@ledgerhq/device-management-kit";

import {
  CONTACTS_VERSION_REQUIREMENTS,
  type ContactsModelSupport,
  ETHEREUM_APP_NAME,
  isContactsSupported,
  isVersionAtLeast,
  resolveContactsVersionRequirements,
} from "./ContactsVersionRequirements";

const BELOW_ANY_VERSION = "0.0.1";
const ABOVE_ANY_VERSION = "999.0.0";

function supportOf(modelId: DeviceModelId): ContactsModelSupport {
  const requirement = resolveContactsVersionRequirements(modelId);
  if (!requirement.supported) {
    throw new Error(`expected ${modelId} to be supported in the test fixture`);
  }
  return requirement;
}

function ethAppVersionOf(support: ContactsModelSupport): string {
  const version = support.minAppVersion[ETHEREUM_APP_NAME];
  if (version === undefined) {
    throw new Error("expected an Ethereum minimum app version in the fixture");
  }
  return version;
}

describe("ContactsVersionRequirements", () => {
  describe("resolveContactsVersionRequirements", () => {
    it("marks every device model, supported or not", () => {
      for (const modelId of Object.values(DeviceModelId)) {
        expect(CONTACTS_VERSION_REQUIREMENTS[modelId]).toBeDefined();
      }
    });

    it("reports Nano models as unsupported", () => {
      expect(resolveContactsVersionRequirements(DeviceModelId.NANO_S)).toEqual({
        supported: false,
      });
      expect(resolveContactsVersionRequirements(DeviceModelId.NANO_X)).toEqual({
        supported: false,
      });
    });

    it("reports touchscreen models as supported with OS and app minimums", () => {
      const flex = supportOf(DeviceModelId.FLEX);
      expect(flex.minOsVersion).toEqual(expect.any(String));
      expect(ethAppVersionOf(flex)).toEqual(expect.any(String));
    });
  });

  describe("isContactsSupported", () => {
    it("returns false for an unsupported device model", () => {
      const flex = supportOf(DeviceModelId.FLEX);
      expect(
        isContactsSupported({
          deviceModelId: DeviceModelId.NANO_S,
          osVersion: ABOVE_ANY_VERSION,
          appName: ETHEREUM_APP_NAME,
          appVersion: ethAppVersionOf(flex),
        }),
      ).toBe(false);
    });

    // App-version requirement.
    it("gates on the minimum app version", () => {
      const flex = supportOf(DeviceModelId.FLEX);
      const minAppVersion = ethAppVersionOf(flex);
      const base = {
        deviceModelId: DeviceModelId.FLEX,
        osVersion: flex.minOsVersion,
        appName: ETHEREUM_APP_NAME,
      };

      expect(
        isContactsSupported({ ...base, appVersion: BELOW_ANY_VERSION }),
      ).toBe(false);
      expect(isContactsSupported({ ...base, appVersion: minAppVersion })).toBe(
        true,
      );
      expect(
        isContactsSupported({ ...base, appVersion: ABOVE_ANY_VERSION }),
      ).toBe(true);
    });

    it("returns false for an app that is unknown to Contacts", () => {
      const flex = supportOf(DeviceModelId.FLEX);
      expect(
        isContactsSupported({
          deviceModelId: DeviceModelId.FLEX,
          osVersion: flex.minOsVersion,
          appName: "Bitcoin",
          appVersion: ABOVE_ANY_VERSION,
        }),
      ).toBe(false);
    });

    // OS-version requirement.
    it("gates on the minimum OS version", () => {
      const flex = supportOf(DeviceModelId.FLEX);
      const base = {
        deviceModelId: DeviceModelId.FLEX,
        appName: ETHEREUM_APP_NAME,
        appVersion: ethAppVersionOf(flex),
      };

      expect(
        isContactsSupported({ ...base, osVersion: BELOW_ANY_VERSION }),
      ).toBe(false);
      expect(
        isContactsSupported({ ...base, osVersion: flex.minOsVersion }),
      ).toBe(true);
    });
  });

  describe("isVersionAtLeast", () => {
    it("compares versions as semver, inclusive of equality", () => {
      expect(isVersionAtLeast("1.2.0", "1.2.0")).toBe(true);
      expect(isVersionAtLeast("1.3.0", "1.2.0")).toBe(true);
      expect(isVersionAtLeast("1.1.9", "1.2.0")).toBe(false);
    });

    it("coerces non-strict version strings", () => {
      expect(isVersionAtLeast("1.2", "1.2.0")).toBe(true);
    });

    it("returns false when a version cannot be parsed", () => {
      expect(isVersionAtLeast("not-a-version", "1.2.0")).toBe(false);
      expect(isVersionAtLeast("1.2.0", "not-a-version")).toBe(false);
    });
  });
});
