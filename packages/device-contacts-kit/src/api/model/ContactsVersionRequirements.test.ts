import { DeviceModelId } from "@ledgerhq/device-management-kit";

import {
  CONTACTS_VERSION_REQUIREMENTS,
  ETHEREUM_APP_NAME,
  isVersionAtLeast,
  resolveContactsVersionRequirements,
} from "./ContactsVersionRequirements";

describe("ContactsVersionRequirements", () => {
  describe("resolveContactsVersionRequirements", () => {
    it("marks every device model, supported or not", () => {
      for (const modelId of Object.values(DeviceModelId)) {
        expect(CONTACTS_VERSION_REQUIREMENTS[modelId]).toBeDefined();
      }
    });

    it("reports Nano S as unsupported", () => {
      expect(resolveContactsVersionRequirements(DeviceModelId.NANO_S)).toEqual({
        supported: false,
      });
    });

    // Pins the minimums themselves, not just their shape: each OS version is
    // the release whose changelog introduces the Address Book feature, so a
    // change here has to be a deliberate one, reviewed against that release.
    it("pins the minimum OS and app versions of every supported model", () => {
      const ethereum = { [ETHEREUM_APP_NAME]: "1.23.0" };

      expect(CONTACTS_VERSION_REQUIREMENTS).toEqual({
        [DeviceModelId.NANO_S]: { supported: false },
        [DeviceModelId.NANO_SP]: {
          supported: true,
          minOsVersion: "1.7.0",
          minAppVersion: ethereum,
        },
        [DeviceModelId.NANO_X]: {
          supported: true,
          minOsVersion: "2.8.0",
          minAppVersion: ethereum,
        },
        [DeviceModelId.STAX]: {
          supported: true,
          minOsVersion: "1.11.0",
          minAppVersion: ethereum,
        },
        [DeviceModelId.FLEX]: {
          supported: true,
          minOsVersion: "1.7.0",
          minAppVersion: ethereum,
        },
        [DeviceModelId.APEX]: {
          supported: true,
          minOsVersion: "1.2.0",
          minAppVersion: ethereum,
        },
      });
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

    it("ignores prerelease and build tags when comparing to the minimum", () => {
      expect(isVersionAtLeast("1.7.0-rc2", "1.7.0")).toBe(true);
      expect(isVersionAtLeast("1.23.0-dev", "1.23.0")).toBe(true);
    });

    it("still fails a minimum strictly above the tagged version's core", () => {
      expect(isVersionAtLeast("1.6.9-rc5", "1.7.0")).toBe(false);
    });
  });
});
