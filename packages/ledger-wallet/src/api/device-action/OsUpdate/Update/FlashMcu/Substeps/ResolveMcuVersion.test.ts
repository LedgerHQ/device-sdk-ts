import {
  type GetOsVersionResponse,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { EitherAsync } from "purify-ts";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { type FinalFirmware } from "@api/device-action/OsUpdate/Shared/types";
import { ResolveMcuVersionError } from "@api/device-action/OsUpdate/Update/FlashMcu/FlashMcuDeviceActionErrors";
import { resolveMcuVersion } from "@api/device-action/OsUpdate/Update/FlashMcu/Substeps/ResolveMcuVersion";

describe("ResolveMcuVersion", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { getManagerApiService: getManagerApiServiceMock } = apiMock;

  const deviceInfo = {
    isBootloader: true,
    isOsu: false,
    targetId: 0x01000001,
    seTargetId: 0x33200004,
    mcuTargetId: 0x01000001,
    seVersion: "1.3.0",
    seFlags: new Uint8Array([0xe6, 0x00, 0x00, 0x00]),
    mcuSephVersion: "",
    mcuBootloaderVersion: "1.16",
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
  } satisfies GetOsVersionResponse;

  const finalFirmware = {
    id: 300,
    version: "1.4.0",
    perso: "perso",
    firmware: "final",
    firmwareKey: "final-key",
    hash: "final-hash",
    bytes: 123,
    mcuVersions: [1, 2],
  } satisfies FinalFirmware;

  const getMcuListMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    getManagerApiServiceMock.mockReturnValue({
      getMcuList: getMcuListMock,
    } as unknown as ReturnType<InternalApi["getManagerApiService"]>);
  });

  const setupMcuList = (
    mcus: Array<{
      id: number;
      name: string;
      fromBootloaderVersion: string;
      providers: number[];
    }>,
  ) => getMcuListMock.mockReturnValue(EitherAsync(() => Promise.resolve(mcus)));

  describe("Success", () => {
    it.each([
      ["0.0", "0.6"],
      ["0.6", "1.5"],
      ["0.7", "1.6"],
      ["0.9", "1.7"],
    ])(
      "Should force the MCU version to %s => %s without fetching the MCU list",
      async (mcuBootloaderVersion, expectedVersion) => {
        const result = await resolveMcuVersion(apiMock)({
          input: {
            deviceInfo: { ...deviceInfo, mcuBootloaderVersion },
            finalFirmware,
          },
        });

        expect(result.extract()).toBe(expectedVersion);
        expect(getManagerApiServiceMock).not.toHaveBeenCalled();
      },
    );

    it("Should return the MCU name when the device is already at its starting bootloader version", async () => {
      setupMcuList([
        {
          id: 1,
          name: "1.12",
          fromBootloaderVersion: "1.16",
          providers: [1],
        },
      ]);

      const result = await resolveMcuVersion(apiMock)({
        input: { deviceInfo, finalFirmware },
      });

      expect(result.extract()).toBe("1.12");
    });

    it("Should return the starting bootloader version when the device is not on it yet", async () => {
      setupMcuList([
        {
          id: 1,
          name: "1.12",
          fromBootloaderVersion: "1.17",
          providers: [1],
        },
      ]);

      const result = await resolveMcuVersion(apiMock)({
        input: { deviceInfo, finalFirmware },
      });

      expect(result.extract()).toBe("1.17");
    });

    it("Should pick the highest MCU version compatible with the final firmware", async () => {
      setupMcuList([
        {
          id: 1,
          name: "1.11",
          fromBootloaderVersion: "1.16",
          providers: [1],
        },
        {
          id: 2,
          name: "1.12",
          fromBootloaderVersion: "1.16",
          providers: [1],
        },
        {
          id: 3,
          name: "1.13",
          fromBootloaderVersion: "1.16",
          providers: [1],
        },
      ]);

      const result = await resolveMcuVersion(apiMock)({
        input: { deviceInfo, finalFirmware },
      });

      expect(result.extract()).toBe("1.12");
    });
  });

  describe("Error", () => {
    it("Should return a ResolveMcuVersionError when the MCU list cannot be fetched", async () => {
      const error = new Error("network failure");
      getMcuListMock.mockReturnValue(
        EitherAsync(() => Promise.reject(error)) as never,
      );

      const result = await resolveMcuVersion(apiMock)({
        input: { deviceInfo, finalFirmware },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveMcuVersionError);
        expect(e.originalError).toBe(error);
      });
    });

    it("Should return a ResolveMcuVersionError when no compatible MCU is found", async () => {
      setupMcuList([
        {
          id: 99,
          name: "1.12",
          fromBootloaderVersion: "1.16",
          providers: [1],
        },
      ]);

      const result = await resolveMcuVersion(apiMock)({
        input: { deviceInfo, finalFirmware },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveMcuVersionError);
      });
    });
  });
});
