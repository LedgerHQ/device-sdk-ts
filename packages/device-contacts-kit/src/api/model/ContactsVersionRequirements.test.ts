import { DeviceModelId } from "@ledgerhq/device-management-kit";

import {
  CONTACTS_VERSION_REQUIREMENTS,
  ETHEREUM_APP_NAME,
  isVersionAtLeast,
  isVersionBelow,
  renameRequiresDerivationPath,
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
          renameDerivationPathRequiredBelowOsVersion: "1.7.0-rc3",
        },
        [DeviceModelId.NANO_X]: {
          supported: true,
          minOsVersion: "2.8.0",
          minAppVersion: ethereum,
          renameDerivationPathRequiredBelowOsVersion: "2.8.0-rc3",
        },
        [DeviceModelId.STAX]: {
          supported: true,
          minOsVersion: "1.11.0",
          minAppVersion: ethereum,
          renameDerivationPathRequiredBelowOsVersion: "1.11.0-rc3",
        },
        [DeviceModelId.FLEX]: {
          supported: true,
          minOsVersion: "1.7.0",
          minAppVersion: ethereum,
          renameDerivationPathRequiredBelowOsVersion: "1.7.0-rc3",
        },
        [DeviceModelId.APEX]: {
          supported: true,
          minOsVersion: "1.2.0",
          minAppVersion: ethereum,
          renameDerivationPathRequiredBelowOsVersion: "1.2.0-rc3",
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

  describe("isVersionBelow", () => {
    it("orders release candidates of the same core (unlike isVersionAtLeast)", () => {
      // The whole reason this helper exists: rc2 must sort below rc3.
      expect(isVersionBelow("1.7.0-rc2", "1.7.0-rc3")).toBe(true);
      expect(isVersionBelow("1.7.0-rc3", "1.7.0-rc3")).toBe(false);
      expect(isVersionBelow("1.7.0-rc4", "1.7.0-rc3")).toBe(false);
    });

    it("treats the final release as newer than any of its prereleases", () => {
      expect(isVersionBelow("1.7.0", "1.7.0-rc3")).toBe(false);
    });

    it("compares the release core when it differs", () => {
      expect(isVersionBelow("1.6.9", "1.7.0-rc3")).toBe(true);
      expect(isVersionBelow("1.8.0", "1.7.0-rc3")).toBe(false);
    });

    it("does not coerce, so a non-strict version is unparseable and returns false", () => {
      expect(isVersionBelow("1.7", "1.7.0-rc3")).toBe(false);
      expect(isVersionBelow("not-a-version", "1.7.0-rc3")).toBe(false);
      expect(isVersionBelow("1.7.0-rc2", "not-a-version")).toBe(false);
    });
  });

  describe("renameRequiresDerivationPath", () => {
    it("requires the path below the model's cutoff (rc2) and not at/after it", () => {
      expect(
        renameRequiresDerivationPath(DeviceModelId.FLEX, "1.7.0-rc2"),
      ).toBe(true);
      expect(
        renameRequiresDerivationPath(DeviceModelId.FLEX, "1.7.0-rc3"),
      ).toBe(false);
      // GA and later never want the path.
      expect(renameRequiresDerivationPath(DeviceModelId.FLEX, "1.7.0")).toBe(
        false,
      );
      expect(renameRequiresDerivationPath(DeviceModelId.FLEX, "1.8.0")).toBe(
        false,
      );
    });

    it("applies the same rc2/rc3 split to the other supported models", () => {
      expect(
        renameRequiresDerivationPath(DeviceModelId.STAX, "1.11.0-rc2"),
      ).toBe(true);
      expect(
        renameRequiresDerivationPath(DeviceModelId.STAX, "1.11.0-rc3"),
      ).toBe(false);
      expect(
        renameRequiresDerivationPath(DeviceModelId.NANO_SP, "1.7.0-rc2"),
      ).toBe(true);
    });

    it("returns false for an unsupported model", () => {
      expect(
        renameRequiresDerivationPath(DeviceModelId.NANO_S, "1.7.0-rc2"),
      ).toBe(false);
    });

    it("returns false (no path) when the OS version is unparseable", () => {
      expect(renameRequiresDerivationPath(DeviceModelId.FLEX, "")).toBe(false);
    });
  });
});
