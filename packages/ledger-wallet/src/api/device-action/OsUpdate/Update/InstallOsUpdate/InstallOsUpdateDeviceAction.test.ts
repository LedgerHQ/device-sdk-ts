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
import { assign, createMachine } from "xstate";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { GetOsVersionError } from "@api/device-action/OsUpdate/Shared/OsUpdateDeviceActionErrors";
import { getOsVersion } from "@api/device-action/OsUpdate/Shared/Substeps/GetOsVersion";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";
import { type OsUpdate } from "@api/device-action/OsUpdate/Shared/types";
import { InstallOsUpdateDeviceAction } from "@api/device-action/OsUpdate/Update/InstallOsUpdate/InstallOsUpdateDeviceAction";
import { installFirmware } from "@api/device-action/OsUpdate/Update/InstallOsUpdate/Substeps/InstallFirmware";
import {
  type InstallOsUpdateDAError,
  type InstallOsUpdateDARequiredInteraction,
  type InstallOsUpdateDAState,
  InstallOsUpdateSteps,
} from "@api/device-action/OsUpdate/Update/InstallOsUpdate/types";

vi.mock("@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion");
vi.mock("@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard");
vi.mock("@api/device-action/OsUpdate/Shared/Substeps/GetOsVersion");
vi.mock(
  "@api/device-action/OsUpdate/Update/InstallOsUpdate/Substeps/InstallFirmware",
);

const pendingState = (
  step: InstallOsUpdateSteps,
  intermediateValue: {
    requiredUserInteraction?: InstallOsUpdateDARequiredInteraction;
    progress?: number;
  } = {},
): InstallOsUpdateDAState => ({
  status: DeviceActionStatus.Pending,
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step,
    ...intermediateValue,
  },
});

const completedState = (): InstallOsUpdateDAState => ({
  status: DeviceActionStatus.Completed,
  output: undefined,
});

const errorState = (error: InstallOsUpdateDAError): InstallOsUpdateDAState => ({
  status: DeviceActionStatus.Error,
  error,
});

const createMockActorMachineFromOutput = (
  output: () => Either<unknown, unknown>,
) =>
  createMachine({
    initial: "ready",
    states: {
      ready: {
        after: { 0: "done" },
        entry: assign({
          intermediateValue: () => ({
            requiredUserInteraction: UserInteractionRequired.None,
          }),
        }),
      },
      done: { type: "final" },
    },
    output,
  });

const createMockActorMachine = (output: Either<unknown, unknown>) =>
  createMockActorMachineFromOutput(() => output);

describe("InstallOsUpdateDeviceAction", () => {
  const getOsVersionResponse = {
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
      hasEndorsementCertificateInSlot1: false,
      hasEndorsementCertificateInSlot2: false,
      numberOfWords: SeedWordCount.TwentyFour,
      currentWordIndex: 0,
      onboardingState: OnboardingState.Unknown,
    },
  } satisfies GetOsVersionResponse;

  const osUpdate = {
    osuFirmware: {
      id: 200,
      notes: "Update notes",
      perso: "perso",
      firmware: "osu",
      firmwareKey: "osu-key",
      hash: "osu-hash",
      nextFinalFirmware: 300,
    },
    finalFirmware: {
      id: 300,
      version: "1.4.0",
      perso: "perso",
      firmware: "final",
      firmwareKey: "final-key",
      hash: "final-hash",
      bytes: 123,
      mcuVersions: [1],
    },
    shouldFlashMcu: false,
  } satisfies OsUpdate;

  type SecureChannelEvents = ReturnType<ReturnType<typeof installFirmware>>;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupWaitForAppAndVersion = (appName = "BOLOS") =>
    vi.mocked(waitForAppAndVersion).mockReturnValue(
      createMockActorMachine(
        Right({
          name: appName,
          version: "1.0.0",
        }),
      ) as unknown as ReturnType<typeof waitForAppAndVersion>,
    );

  const setupWaitForAppAndVersionSequence = (appNames: string[]) => {
    const remainingAppNames = [...appNames];
    vi.mocked(waitForAppAndVersion).mockReturnValue(
      createMockActorMachineFromOutput(() =>
        Right({
          name: remainingAppNames.shift() ?? "BOLOS",
          version: "1.0.0",
        }),
      ) as unknown as ReturnType<typeof waitForAppAndVersion>,
    );
  };

  const setupGoToDashboard = (
    output: Either<unknown, unknown> = Right(undefined),
  ) =>
    vi
      .mocked(goToDashboard)
      .mockReturnValue(
        createMockActorMachine(output) as unknown as ReturnType<
          typeof goToDashboard
        >,
      );

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

  const setupInstallFirmware = (events: SecureChannelEvents = of()) => {
    const handler = vi.fn().mockReturnValue(events);
    vi.mocked(installFirmware).mockReturnValue(handler);
    return handler;
  };

  const makeDeviceAction = () =>
    new InstallOsUpdateDeviceAction({
      input: {
        osUpdate,
        unlockTimeout: 30_000,
      },
    });

  describe("Success", () => {
    it("Should install the OSU firmware when the device is not in OSU mode", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetOsVersion();
        const installFirmwareHandler = setupInstallFirmware();

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: () => {
              expect(installFirmwareHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    deviceInfo: getOsVersionResponse,
                    firmware: {
                      perso: "perso",
                      firmware: "osu",
                      firmwareKey: "osu-key",
                    },
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("Should install the final firmware when the device is in OSU mode", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetOsVersion(Right({ ...getOsVersionResponse, isOsu: true }));
        const installFirmwareHandler = setupInstallFirmware();

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: () => {
              expect(installFirmwareHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    deviceInfo: { ...getOsVersionResponse, isOsu: true },
                    firmware: {
                      perso: "perso",
                      firmware: "final",
                      firmwareKey: "final-key",
                    },
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("Should only track progress while installing the final firmware", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetOsVersion(Right({ ...getOsVersionResponse, isOsu: true }));
        setupInstallFirmware(
          of(
            { type: SecureChannelEventType.PermissionRequested },
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

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware, { progress: 0.5 }),
          pendingState(InstallOsUpdateSteps.InstallFirmware, { progress: 1 }),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should go to dashboard and wait for app and version again when an app is open", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionSequence(["Bitcoin", "BOLOS"]);
        setupGoToDashboard();
        setupGetOsVersion();
        setupInstallFirmware();

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GoToDashboard),
          pendingState(InstallOsUpdateSteps.GoToDashboard),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should request the secure connection permission then clear it once granted while installing the OSU", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetOsVersion();
        setupInstallFirmware(
          of(
            { type: SecureChannelEventType.PermissionRequested },
            { type: SecureChannelEventType.PermissionGranted },
          ) as SecureChannelEvents,
        );

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware, {
            requiredUserInteraction:
              UserInteractionRequired.AllowSecureConnection,
          }),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should report progress and request install confirmation on the last OSU APDU", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetOsVersion();
        setupInstallFirmware(
          of(
            {
              type: SecureChannelEventType.Progress,
              payload: { progress: 0.99, index: 0, total: 2 },
            },
            {
              type: SecureChannelEventType.Progress,
              payload: { progress: 1, index: 1, total: 2 },
            },
          ) as SecureChannelEvents,
        );

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware, {
            progress: 0.99,
            requiredUserInteraction:
              UserInteractionRequired.AllowInstallFirmware,
          }),
          pendingState(InstallOsUpdateSteps.InstallFirmware, {
            progress: 1,
            requiredUserInteraction: UserInteractionRequired.None,
          }),
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
    it("Should go to Error when waitForAppAndVersion returns Left", () =>
      new Promise<void>((resolve, reject) => {
        const error = new UnknownDAError("waitForAppAndVersion failed");
        vi.mocked(waitForAppAndVersion).mockReturnValue(
          createMockActorMachine(Left(error)) as unknown as ReturnType<
            typeof waitForAppAndVersion
          >,
        );

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should go to Error when goToDashboard returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion("Bitcoin");
        const error = new UnknownDAError("goToDashboard failed");
        setupGoToDashboard(Left(error));

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GoToDashboard),
          pendingState(InstallOsUpdateSteps.GoToDashboard),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should go to Error when getOsVersion returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        const error = new GetOsVersionError(new Error("command failed"));
        setupGetOsVersion(Left(error));

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
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
        setupWaitForAppAndVersion();
        setupGetOsVersion();
        setupInstallFirmware(
          of({
            type: SecureChannelEventType.Error,
            error: new SecureChannelError("install failed"),
          }) as SecureChannelEvents,
        );

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
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
        setupWaitForAppAndVersion();
        setupGetOsVersion();
        const error = new UnknownDAError("Invalid WebSocket connection");
        setupInstallFirmware(
          new Observable((subscriber) => {
            subscriber.error(error);
          }) as SecureChannelEvents,
        );

        const expectedStates: InstallOsUpdateDAState[] = [
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.WaitForAppAndVersion),
          pendingState(InstallOsUpdateSteps.GetDeviceInfo),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
          pendingState(InstallOsUpdateSteps.InstallFirmware),
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
