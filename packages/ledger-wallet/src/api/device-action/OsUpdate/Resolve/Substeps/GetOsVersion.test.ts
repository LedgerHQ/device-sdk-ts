import {
  CommandResultFactory,
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { GetOsVersionError } from "@api/device-action/OsUpdate/Resolve/ResolveOsUpdatePathDeviceActionErrors";
import { getOsVersion } from "@api/device-action/OsUpdate/Resolve/Substeps/GetOsVersion";

describe("GetOsVersion", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { sendCommand: sendCommandMock } = apiMock;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the OS version response", async () => {
      const osVersion = {
        isBootloader: false,
        isOsu: false,
        targetId: 0x33200004,
        seTargetId: 0x33200004,
        mcuTargetId: undefined,
        seVersion: "1.3.0",
        seFlags: new Uint8Array([0xe6, 0x00, 0x00, 0x00]),
        mcuSephVersion: "5.24",
        mcuBootloaderVersion: "0.48",
        hwVersion: "00",
        langId: 0,
        recoverState: undefined,
        secureElementFlags: {
          isPinValidated: true,
          hasMcuSerialNumber: true,
          hasValidCertificate: true,
          isCustomAuthorityConnectionAllowed: false,
          isSecureConnectionAllowed: false,
          isOnboarded: true,
          isMcuCodeSigned: true,
          isInRecoveryMode: false,
        },
      };
      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({ data: osVersion }),
      );

      const result = await getOsVersion(apiMock)();

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toEqual(osVersion);
    });
  });

  describe("Error", () => {
    it("Should return GetOsVersionError", async () => {
      const error = new GlobalCommandError({
        errorCode: "6e00",
        ...GLOBAL_ERRORS["6e00"],
      });
      sendCommandMock.mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await getOsVersion(apiMock)();

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(GetOsVersionError);
        expect(e.originalError).toBe(error.originalError);
      });
    });
  });
});
