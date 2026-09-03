import {
  DeviceActionStatus,
  type GetOsVersionResponse,
  OnboardingState,
  SeedWordCount,
  SecureChannelError,
  SecureChannelEventType,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { Observable, of } from "rxjs";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { GetOsVersionError } from "@api/device-action/OsUpdate/Shared/OsUpdateDeviceActionErrors";
import { getOsVersion } from "@api/device-action/OsUpdate/Shared/Substeps/GetOsVersion";
import { type FinalFirmware } from "@api/device-action/OsUpdate/Shared/types";
import { FlashMcuDeviceAction } from "@api/device-action/OsUpdate/Update/FlashMcu/FlashMcuDeviceAction";
import {
  BootloaderModeTimeoutError,
  ResolveMcuVersionError,
} from "@api/device-action/OsUpdate/Update/FlashMcu/FlashMcuDeviceActionErrors";
import { flashMcu } from "@api/device-action/OsUpdate/Update/FlashMcu/Substeps/FlashMcu";
import { resolveMcuVersion } from "@api/device-action/OsUpdate/Update/FlashMcu/Substeps/ResolveMcuVersion";
import {
  type FlashMcuDAError,
  type FlashMcuDAState,
  FlashMcuSteps,
} from "@api/device-action/OsUpdate/Update/FlashMcu/types";

vi.mock("@api/device-action/OsUpdate/Shared/Substeps/GetOsVersion");
vi.mock(
  "@api/device-action/OsUpdate/Update/FlashMcu/Substeps/ResolveMcuVersion",
);
vi.mock("@api/device-action/OsUpdate/Update/FlashMcu/Substeps/FlashMcu");

const pendingState = (
  step: FlashMcuSteps,
  intermediateValue: { progress?: number } = {},
): FlashMcuDAState => ({
  status: DeviceActionStatus.Pending,
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step,
    ...intermediateValue,
  },
});

const completedState = (): FlashMcuDAState => ({
  status: DeviceActionStatus.Completed,
  output: undefined,
});

const errorState = (error: FlashMcuDAError): FlashMcuDAState => ({
  status: DeviceActionStatus.Error,
  error,
});

/*
 * A poll that does not find the device in bootloader mode emits twice: once on
 * entering GetDeviceInfo, once on entering the waiting state.
 */
const bootloaderPollStates = (attempts: number): FlashMcuDAState[] =>
  Array.from({ length: attempts * 2 - 1 }, () =>
    pendingState(FlashMcuSteps.GetDeviceInfo),
  );

describe("FlashMcuDeviceAction", () => {
  const getOsVersionResponse = {
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
    mcuVersions: [1],
  } satisfies FinalFirmware;

  type SecureChannelEvents = ReturnType<ReturnType<typeof flashMcu>>;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupGetOsVersion = (
    result: Either<unknown, GetOsVersionResponse> = Right(getOsVersionResponse),
  ) =>
    vi
      .mocked(getOsVersion)
      .mockReturnValue(
        () =>
          Promise.resolve(result) as ReturnType<
            ReturnType<typeof getOsVersion>
          >,
      );

  const setupGetOsVersionSequence = (
    results: Array<Either<unknown, GetOsVersionResponse>>,
  ) => {
    const remaining = [...results];
    vi.mocked(getOsVersion).mockReturnValue(
      () =>
        Promise.resolve(
          remaining.shift() ?? Right(getOsVersionResponse),
        ) as ReturnType<ReturnType<typeof getOsVersion>>,
    );
  };

  const setupResolveMcuVersion = (
    result: Either<unknown, string> = Right("1.12"),
  ) => {
    const handler = vi.fn().mockResolvedValue(result);
    vi.mocked(resolveMcuVersion).mockReturnValue(
      handler as unknown as ReturnType<typeof resolveMcuVersion>,
    );
    return handler;
  };

  const setupFlashMcu = (events: SecureChannelEvents = of()) => {
    const handler = vi.fn().mockReturnValue(events);
    vi.mocked(flashMcu).mockReturnValue(handler);
    return handler;
  };

  const makeDeviceAction = () =>
    new FlashMcuDeviceAction({
      input: {
        finalFirmware,
      },
    });

  describe("Success", () => {
    it("Should flash the MCU when the device is already in bootloader mode", () =>
      new Promise<void>((resolve, reject) => {
        setupGetOsVersion();
        const resolveMcuVersionHandler = setupResolveMcuVersion();
        const flashMcuHandler = setupFlashMcu();

        const expectedStates: FlashMcuDAState[] = [
          pendingState(FlashMcuSteps.GetDeviceInfo),
          pendingState(FlashMcuSteps.ResolveMcuVersion),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: () => {
              expect(resolveMcuVersionHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: { deviceInfo: getOsVersionResponse, finalFirmware },
                }),
              );
              expect(flashMcuHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    deviceInfo: getOsVersionResponse,
                    version: "1.12",
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("Should poll until the device enters bootloader mode", async () => {
      vi.useFakeTimers();
      setupGetOsVersionSequence([
        Right({ ...getOsVersionResponse, isBootloader: false }),
        Right({ ...getOsVersionResponse, isBootloader: false }),
        Right(getOsVersionResponse),
      ]);
      setupResolveMcuVersion();
      setupFlashMcu();

      const expectedStates: FlashMcuDAState[] = [
        ...bootloaderPollStates(3),
        pendingState(FlashMcuSteps.ResolveMcuVersion),
        pendingState(FlashMcuSteps.FlashMcuOrBootloader),
        pendingState(FlashMcuSteps.FlashMcuOrBootloader),
        completedState(),
      ];

      const done = new Promise<void>((resolve, reject) => {
        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      });

      await vi.advanceTimersByTimeAsync(2000 * 3);
      await done;
      vi.useRealTimers();
    });

    it("Should report the flash progress", () =>
      new Promise<void>((resolve, reject) => {
        setupGetOsVersion();
        setupResolveMcuVersion();
        setupFlashMcu(
          of(
            {
              type: SecureChannelEventType.Progress,
              payload: { progress: 0.5, index: 0, total: 2 },
            },
            {
              type: SecureChannelEventType.Progress,
              payload: { progress: 1, index: 1, total: 2 },
            },
          ) as SecureChannelEvents,
        );

        const expectedStates: FlashMcuDAState[] = [
          pendingState(FlashMcuSteps.GetDeviceInfo),
          pendingState(FlashMcuSteps.ResolveMcuVersion),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader, { progress: 0.5 }),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader, { progress: 1 }),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));
  });

  describe("Error", () => {
    it("Should go to Error when getOsVersion returns Left", () =>
      new Promise<void>((resolve, reject) => {
        const error = new GetOsVersionError(new Error("command failed"));
        setupGetOsVersion(Left(error));

        const expectedStates: FlashMcuDAState[] = [
          pendingState(FlashMcuSteps.GetDeviceInfo),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should go to Error when the device never enters bootloader mode", async () => {
      vi.useFakeTimers();
      setupGetOsVersion(
        Right({ ...getOsVersionResponse, isBootloader: false }),
      );

      const expectedStates: FlashMcuDAState[] = [
        ...bootloaderPollStates(10),
        errorState(
          new BootloaderModeTimeoutError(
            "Device did not enter bootloader mode after 10 attempts",
          ),
        ),
      ];

      const done = new Promise<void>((resolve, reject) => {
        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      });

      await vi.advanceTimersByTimeAsync(2000 * 11);
      await done;
      vi.useRealTimers();
    });

    it("Should go to Error when resolveMcuVersion returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupGetOsVersion();
        const error = new ResolveMcuVersionError("no compatible MCU");
        setupResolveMcuVersion(Left(error));

        const expectedStates: FlashMcuDAState[] = [
          pendingState(FlashMcuSteps.GetDeviceInfo),
          pendingState(FlashMcuSteps.ResolveMcuVersion),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should map a secure channel error event to a device action error", () =>
      new Promise<void>((resolve, reject) => {
        setupGetOsVersion();
        setupResolveMcuVersion();
        setupFlashMcu(
          of({
            type: SecureChannelEventType.Error,
            error: new SecureChannelError("flash failed"),
          }) as SecureChannelEvents,
        );

        const expectedStates: FlashMcuDAState[] = [
          pendingState(FlashMcuSteps.GetDeviceInfo),
          pendingState(FlashMcuSteps.ResolveMcuVersion),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          errorState(new UnknownDAError()),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should go to Error when the secure channel connection cannot be opened", () =>
      new Promise<void>((resolve, reject) => {
        setupGetOsVersion();
        setupResolveMcuVersion();
        const error = new UnknownDAError("Invalid WebSocket connection");
        setupFlashMcu(
          new Observable((subscriber) => {
            subscriber.error(error);
          }) as SecureChannelEvents,
        );

        const expectedStates: FlashMcuDAState[] = [
          pendingState(FlashMcuSteps.GetDeviceInfo),
          pendingState(FlashMcuSteps.ResolveMcuVersion),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          pendingState(FlashMcuSteps.FlashMcuOrBootloader),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));
  });
});
