import {
  type GetOsVersionResponse,
  OnboardingState,
} from "@ledgerhq/device-management-kit";
import { EitherAsync, Just, Nothing } from "purify-ts";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { ResolveOsUpdatePathError } from "@api/device-action/OsUpdate/Resolve/ResolveOsUpdatePathDeviceActionErrors";
import { resolveOsUpdatePath } from "@api/device-action/OsUpdate/Resolve/Substeps/ResolveOsUpdatePath";
import {
  type FinalFirmware,
  type McuFirmware,
  type OsuFirmware,
} from "@api/device-action/OsUpdate/Shared/types";

const rightAsync = <T>(value: T) =>
  EitherAsync<unknown, T>(() => Promise.resolve(value));

const leftAsync = (error: unknown) =>
  EitherAsync<unknown, never>(({ throwE }) => Promise.resolve(throwE(error)));

describe("ResolveOsUpdatePath", () => {
  const DEFAULT_MANAGER_API_PROVIDER = 1;

  const apiMock = makeDeviceActionInternalApiMock();

  const getOsVersionResponse = {
    isBootloader: false,
    isOsu: false,
    targetId: 0x33200004,
    seTargetId: 0x33200004,
    mcuTargetId: undefined,
    seVersion: "1.3.0",
    seFlags: new Uint8Array([0xe6, 0x00, 0x00, 0x00]),
    mcuSephVersion: "1.0.0",
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
      hasEndorsementCertificateInSlot1: false,
      hasEndorsementCertificateInSlot2: false,
      numberOfWords: 24,
      currentWordIndex: 0,
      onboardingState: OnboardingState.Unknown,
    },
  } satisfies GetOsVersionResponse;

  const deviceVersion = {
    id: 17,
    target_id: "857735172",
    name: "Ledger Stax",
  };

  const currentFirmware = {
    id: 100,
    version: "1.3.0",
    perso: "perso",
    firmware: null,
    firmwareKey: null,
    hash: null,
    bytes: null,
    mcuVersions: [1],
  } satisfies FinalFirmware;

  const firstOsuFirmware = {
    id: 200,
    notes: "Update notes",
    perso: "perso",
    firmware: "osu",
    firmwareKey: "osu-key",
    hash: "osu-hash",
    nextFinalFirmware: 300,
  } satisfies OsuFirmware;

  const secondOsuFirmware = {
    ...firstOsuFirmware,
    id: 201,
    nextFinalFirmware: 301,
  } satisfies OsuFirmware;

  const firstFinalFirmware = {
    id: 300,
    version: "1.4.0",
    perso: "perso",
    firmware: "final",
    firmwareKey: "final-key",
    hash: "final-hash",
    bytes: 123,
    mcuVersions: [1],
  } satisfies FinalFirmware;

  const secondFinalFirmware = {
    ...firstFinalFirmware,
    id: 301,
    version: "1.5.0",
    mcuVersions: [3],
  } satisfies FinalFirmware;

  const mcuList = [
    {
      id: 1,
      name: "1.0.0",
      fromBootloaderVersion: "0.0",
      providers: [1],
    },
    {
      id: 3,
      name: "3.0.0",
      fromBootloaderVersion: "0.0",
      providers: [1, 2],
    },
  ] satisfies McuFirmware[];

  const managerApiMock = {
    getMcuList: vi.fn(),
    getDeviceVersion: vi.fn(),
    getFirmwareVersion: vi.fn(),
    getOsuFirmwareVersion: vi.fn(),
    getLatestFirmwareVersion: vi.fn(),
    getNextFirmwareVersion: vi.fn(),
    getProvider: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.getManagerApiService.mockReturnValue(managerApiMock as never);
    managerApiMock.getMcuList.mockReturnValue(rightAsync(mcuList));
    managerApiMock.getDeviceVersion.mockReturnValue(rightAsync(deviceVersion));
    managerApiMock.getFirmwareVersion.mockReturnValue(
      rightAsync(currentFirmware),
    );
    managerApiMock.getLatestFirmwareVersion.mockReturnValue(
      rightAsync(Just(firstOsuFirmware)),
    );
    managerApiMock.getOsuFirmwareVersion.mockReturnValue(
      rightAsync(firstOsuFirmware),
    );
    managerApiMock.getNextFirmwareVersion.mockReturnValue(
      rightAsync(firstFinalFirmware),
    );
    managerApiMock.getProvider.mockReturnValue(DEFAULT_MANAGER_API_PROVIDER);
  });

  describe("Success", () => {
    it("Should return an empty update path when no firmware update is available", async () => {
      managerApiMock.getLatestFirmwareVersion.mockReturnValueOnce(
        rightAsync(Nothing),
      );

      const result = await resolveOsUpdatePath(apiMock)({
        input: { getOsVersionResponse },
      });

      expect(result.extract()).toEqual([]);
      expect(managerApiMock.getDeviceVersion).toHaveBeenCalledWith(
        getOsVersionResponse,
      );
      expect(managerApiMock.getFirmwareVersion).toHaveBeenCalledWith(
        getOsVersionResponse,
        deviceVersion,
      );
      expect(managerApiMock.getLatestFirmwareVersion).toHaveBeenCalledWith(
        currentFirmware,
        deviceVersion,
      );
      expect(managerApiMock.getNextFirmwareVersion).not.toHaveBeenCalled();
    });

    it("Should resolve a single update without MCU flash when the final firmware supports the current MCU", async () => {
      managerApiMock.getLatestFirmwareVersion
        .mockReturnValueOnce(rightAsync(Just(firstOsuFirmware)))
        .mockReturnValueOnce(rightAsync(Nothing));

      const result = await resolveOsUpdatePath(apiMock)({
        input: { getOsVersionResponse },
      });

      expect(result.extract()).toEqual([
        {
          osuFirmware: firstOsuFirmware,
          finalFirmware: firstFinalFirmware,
          shouldFlashMcu: false,
        },
      ]);
    });

    it("Should resolve OSU mode from the OSU firmware endpoint", async () => {
      managerApiMock.getLatestFirmwareVersion.mockReturnValueOnce(
        rightAsync(Nothing),
      );

      const osVersionResponse = {
        ...getOsVersionResponse,
        isOsu: true,
      } satisfies GetOsVersionResponse;
      const result = await resolveOsUpdatePath(apiMock)({
        input: { getOsVersionResponse: osVersionResponse },
      });

      expect(result.extract()).toEqual([
        {
          osuFirmware: firstOsuFirmware,
          finalFirmware: firstFinalFirmware,
          shouldFlashMcu: false,
        },
      ]);
      expect(managerApiMock.getOsuFirmwareVersion).toHaveBeenCalledWith(
        osVersionResponse,
        deviceVersion,
      );
      expect(managerApiMock.getFirmwareVersion).not.toHaveBeenCalled();
    });

    it("Should resolve multiple updates and flag the one requiring an MCU flash", async () => {
      managerApiMock.getLatestFirmwareVersion
        .mockReturnValueOnce(rightAsync(Just(firstOsuFirmware)))
        .mockReturnValueOnce(rightAsync(Just(secondOsuFirmware)))
        .mockReturnValueOnce(rightAsync(Nothing));
      managerApiMock.getNextFirmwareVersion
        .mockReturnValueOnce(rightAsync(firstFinalFirmware))
        .mockReturnValueOnce(rightAsync(secondFinalFirmware));

      const result = await resolveOsUpdatePath(apiMock)({
        input: { getOsVersionResponse },
      });

      expect(result.extract()).toEqual([
        {
          osuFirmware: firstOsuFirmware,
          finalFirmware: firstFinalFirmware,
          shouldFlashMcu: false,
        },
        {
          osuFirmware: secondOsuFirmware,
          finalFirmware: secondFinalFirmware,
          shouldFlashMcu: true,
        },
      ]);
      expect(managerApiMock.getDeviceVersion).toHaveBeenCalledTimes(1);
      expect(managerApiMock.getLatestFirmwareVersion).toHaveBeenNthCalledWith(
        2,
        firstFinalFirmware,
        deviceVersion,
      );
    });

    it("Should resolve the latest compatible MCU when MCU names are not strict semver", async () => {
      const managerMcuList = [
        {
          id: 1,
          name: "1.0",
          fromBootloaderVersion: "0.0",
          providers: [1],
        },
        {
          id: 2,
          name: "1.1",
          fromBootloaderVersion: "0.0",
          providers: [1, 2],
        },
        {
          id: 3,
          name: "1.2",
          fromBootloaderVersion: "0.0",
          providers: [1, 2, 3],
        },
      ] satisfies McuFirmware[];
      const finalFirmwareRequiringMcuFlash = {
        ...firstFinalFirmware,
        mcuVersions: [2, 3],
      } satisfies FinalFirmware;
      const finalFirmwareSupportingLatestMcu = {
        ...secondFinalFirmware,
        mcuVersions: [3],
      } satisfies FinalFirmware;

      managerApiMock.getMcuList.mockReturnValueOnce(rightAsync(managerMcuList));
      managerApiMock.getLatestFirmwareVersion
        .mockReturnValueOnce(rightAsync(Just(firstOsuFirmware)))
        .mockReturnValueOnce(rightAsync(Just(secondOsuFirmware)))
        .mockReturnValueOnce(rightAsync(Nothing));
      managerApiMock.getNextFirmwareVersion
        .mockReturnValueOnce(rightAsync(finalFirmwareRequiringMcuFlash))
        .mockReturnValueOnce(rightAsync(finalFirmwareSupportingLatestMcu));

      const result = await resolveOsUpdatePath(apiMock)({
        input: {
          getOsVersionResponse: {
            ...getOsVersionResponse,
            mcuSephVersion: "1.0",
          },
        },
      });

      expect(result.extract()).toEqual([
        {
          osuFirmware: firstOsuFirmware,
          finalFirmware: finalFirmwareRequiringMcuFlash,
          shouldFlashMcu: true,
        },
        {
          osuFirmware: secondOsuFirmware,
          finalFirmware: finalFirmwareSupportingLatestMcu,
          shouldFlashMcu: false,
        },
      ]);
    });
  });

  describe("Error", () => {
    it("Should return ResolveOsUpdatePathError when the MCU list cannot be fetched", async () => {
      const error = new Error("mcu list failed");
      managerApiMock.getMcuList.mockReturnValueOnce(leftAsync(error));

      const result = await resolveOsUpdatePath(apiMock)({
        input: { getOsVersionResponse },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveOsUpdatePathError);
        expect(e.originalError).toBe(error);
      });
    });

    it("Should return ResolveOsUpdatePathError when the current MCU version is unknown", async () => {
      const result = await resolveOsUpdatePath(apiMock)({
        input: {
          getOsVersionResponse: {
            ...getOsVersionResponse,
            mcuSephVersion: "9.9.9",
          },
        },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveOsUpdatePathError);
        expect(e.originalError).toBe("No MCU firmware found for version 9.9.9");
      });
    });

    it("Should return ResolveOsUpdatePathError when no compatible MCU can be resolved for the next firmware", async () => {
      managerApiMock.getNextFirmwareVersion.mockReturnValueOnce(
        rightAsync({
          ...firstFinalFirmware,
          mcuVersions: [42],
        }),
      );

      const result = await resolveOsUpdatePath(apiMock)({
        input: { getOsVersionResponse },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(ResolveOsUpdatePathError);
        expect(e.originalError).toBe("No MCU firmware found for version null");
      });
    });
  });
});
