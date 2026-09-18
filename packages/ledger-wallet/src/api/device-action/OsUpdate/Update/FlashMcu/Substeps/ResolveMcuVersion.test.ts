import {
  type GetOsVersionResponse,
  type InternalApi,
  OnboardingState,
  SeedWordCount,
} from "@ledgerhq/device-management-kit";
import { EitherAsync } from "purify-ts";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { type FinalFirmware } from "@api/device-action/OsUpdate/Shared/types";
import { ResolveMcuVersionError } from "@api/device-action/OsUpdate/Update/FlashMcu/FlashMcuDeviceActionErrors";
import { resolveMcuVersion } from "@api/device-action/OsUpdate/Update/FlashMcu/Substeps/ResolveMcuVersion";

describe("ResolveMcuVersion", () => {
  const DEFAULT_MANAGER_API_PROVIDER = 1;
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
      hasEndorsementCertificateInSlot1: false,
      hasEndorsementCertificateInSlot2: false,
      numberOfWords: SeedWordCount.TwentyFour,
      currentWordIndex: 0,
      onboardingState: OnboardingState.Unknown,
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

  const deviceVersion = { id: 17 };

  const getMcuListMock = vi.fn();
  const getProviderMock = vi.fn();
  const getDeviceVersionMock = vi.fn();
  const getFirmwareVersionMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    getProviderMock.mockReturnValue(DEFAULT_MANAGER_API_PROVIDER);
    getManagerApiServiceMock.mockReturnValue({
      getMcuList: getMcuListMock,
      getProvider: getProviderMock,
      getDeviceVersion: getDeviceVersionMock,
      getFirmwareVersion: getFirmwareVersionMock,
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

  const setupSecureElementFirmware = (firmware: FinalFirmware) => {
    getDeviceVersionMock.mockReturnValue(
      EitherAsync(() => Promise.resolve(deviceVersion)),
    );
    getFirmwareVersionMock.mockReturnValue(
      EitherAsync(() => Promise.resolve(firmware)),
    );
  };

  describe("Success", () => {
    it.each([["0.0"], ["0.0.0"]])(
      "Should force the MCU version of a bootloader reporting %s without fetching the MCU list",
      async (mcuBootloaderVersion) => {
        const result = await resolveMcuVersion(apiMock)({
          input: {
            mode: "osUpdate",
            deviceInfo: { ...deviceInfo, mcuBootloaderVersion },
            finalFirmware,
          },
        });

        expect(result.extract()).toBe("0.6");
        expect(getManagerApiServiceMock).not.toHaveBeenCalled();
      },
    );

    /*
     * The recovery hops bypass the catalog, which an OS update must not do: it
     * knows the firmware it is making room for, so the catalog has the answer.
     */
    it.each([["0.6"], ["0.7"], ["0.9"]])(
      "Should resolve a bootloader reporting %s from the catalog rather than from the recovery hops",
      async (mcuBootloaderVersion) => {
        setupMcuList([
          {
            id: 1,
            name: "1.12",
            fromBootloaderVersion: mcuBootloaderVersion,
            providers: [1],
          },
        ]);

        const result = await resolveMcuVersion(apiMock)({
          input: {
            mode: "osUpdate",
            deviceInfo: { ...deviceInfo, mcuBootloaderVersion },
            finalFirmware,
          },
        });

        expect(result.extract()).toBe("1.12");
        expect(getMcuListMock).toHaveBeenCalled();
      },
    );

    it("Should return the MCU name when the device is already at its starting bootloader version", async () => {
      getProviderMock.mockReturnValue(12);
      setupMcuList([
        {
          id: 1,
          name: "1.12",
          fromBootloaderVersion: "1.16",
          providers: [12],
        },
      ]);

      const result = await resolveMcuVersion(apiMock)({
        input: { mode: "osUpdate", deviceInfo, finalFirmware },
      });

      expect(result.extract()).toBe("1.12");
    });

    it("Should ignore the number of segments when comparing bootloader versions", async () => {
      setupMcuList([
        {
          id: 1,
          name: "1.12",
          fromBootloaderVersion: "1.16.0",
          providers: [1],
        },
      ]);

      const result = await resolveMcuVersion(apiMock)({
        input: { mode: "osUpdate", deviceInfo, finalFirmware },
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
        input: { mode: "osUpdate", deviceInfo, finalFirmware },
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
        input: { mode: "osUpdate", deviceInfo, finalFirmware },
      });

      expect(result.extract()).toBe("1.12");
    });
  });

  describe("Bootloader recovery", () => {
    const recoveryDeviceInfoWithoutSecureElement = {
      ...deviceInfo,
      seVersion: "",
      seTargetId: undefined,
    } satisfies GetOsVersionResponse;

    it.each([
      ["0.0", "0.6"],
      ["0.0.0", "0.6"],
      ["0.6", "1.5"],
      ["0.7", "1.6"],
      ["0.9", "1.7"],
    ])(
      "Should force the MCU version to %s => %s without reaching the Manager API",
      async (mcuBootloaderVersion, expectedVersion) => {
        const result = await resolveMcuVersion(apiMock)({
          input: {
            mode: "bootloaderRecovery",
            deviceInfo: { ...deviceInfo, mcuBootloaderVersion },
          },
        });

        expect(result.extract()).toBe(expectedVersion);
        expect(getManagerApiServiceMock).not.toHaveBeenCalled();
      },
    );

    it("Should resolve the final firmware of the secure element, not of the MCU", async () => {
      setupMcuList([
        {
          id: 1,
          name: "1.12",
          fromBootloaderVersion: "1.16",
          providers: [1],
        },
      ]);
      setupSecureElementFirmware(finalFirmware);

      const result = await resolveMcuVersion(apiMock)({
        input: { mode: "bootloaderRecovery", deviceInfo },
      });

      expect(result.extract()).toBe("1.12");
      expect(getDeviceVersionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: deviceInfo.seTargetId,
          seVersion: deviceInfo.seVersion,
        }),
      );
      expect(getFirmwareVersionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: deviceInfo.seTargetId,
          seVersion: deviceInfo.seVersion,
        }),
        deviceVersion,
      );
    });

    it("Should fall back to the bootloader version when the device reports no secure element firmware", async () => {
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
          fromBootloaderVersion: "1.17",
          providers: [1],
        },
      ]);

      const result = await resolveMcuVersion(apiMock)({
        input: {
          mode: "bootloaderRecovery",
          deviceInfo: recoveryDeviceInfoWithoutSecureElement,
        },
      });

      expect(result.extract()).toBe("1.12");
      expect(getDeviceVersionMock).not.toHaveBeenCalled();
    });

    it("Should ignore MCU firmwares of another provider in the fallback", async () => {
      setupMcuList([
        {
          id: 1,
          name: "1.12",
          fromBootloaderVersion: "1.16",
          providers: [12],
        },
      ]);

      const result = await resolveMcuVersion(apiMock)({
        input: {
          mode: "bootloaderRecovery",
          deviceInfo: recoveryDeviceInfoWithoutSecureElement,
        },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveMcuVersionError);
      });
    });

    it("Should return a ResolveMcuVersionError when the MCU list is empty", async () => {
      setupMcuList([]);
      setupSecureElementFirmware(finalFirmware);

      const result = await resolveMcuVersion(apiMock)({
        input: { mode: "bootloaderRecovery", deviceInfo },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveMcuVersionError);
      });
    });

    /*
     * The secure element version is sent to the Manager API as reported, so a
     * device left in OSU state has no final firmware to recover towards.
     */
    it("Should return a ResolveMcuVersionError when the secure element firmware is unknown", async () => {
      const error = new Error("not found");
      setupMcuList([
        {
          id: 1,
          name: "1.12",
          fromBootloaderVersion: "1.16",
          providers: [1],
        },
      ]);
      getDeviceVersionMock.mockReturnValue(
        EitherAsync(() => Promise.resolve(deviceVersion)),
      );
      getFirmwareVersionMock.mockReturnValue(
        EitherAsync(() => Promise.reject(error)),
      );

      const result = await resolveMcuVersion(apiMock)({
        input: {
          mode: "bootloaderRecovery",
          deviceInfo: { ...deviceInfo, seVersion: "2.2.3-osu" },
        },
      });

      expect(getFirmwareVersionMock).toHaveBeenCalledWith(
        expect.objectContaining({ seVersion: "2.2.3-osu" }),
        deviceVersion,
      );
      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveMcuVersionError);
        expect(e.originalError).toBe(error);
      });
    });
  });

  describe("Error", () => {
    it("Should return a ResolveMcuVersionError when the MCU list cannot be fetched", async () => {
      const error = new Error("network failure");
      getMcuListMock.mockReturnValue(
        EitherAsync(() => Promise.reject(error)) as never,
      );

      const result = await resolveMcuVersion(apiMock)({
        input: { mode: "osUpdate", deviceInfo, finalFirmware },
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
        input: { mode: "osUpdate", deviceInfo, finalFirmware },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveMcuVersionError);
      });
    });
  });
});
