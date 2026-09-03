import {
  DeviceActionStatus,
  type GetOsVersionResponse,
  OnboardingState,
  SeedWordCount,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { ResolveOsUpdatePathDeviceAction } from "@api/device-action/OsUpdate/Resolve/ResolveOsUpdatePathDeviceAction";
import { ResolveOsUpdatePathError } from "@api/device-action/OsUpdate/Resolve/ResolveOsUpdatePathDeviceActionErrors";
import { resolveOsUpdatePath } from "@api/device-action/OsUpdate/Resolve/Substeps/ResolveOsUpdatePath";
import {
  type ResolveOsUpdatePathDAError,
  type ResolveOsUpdatePathDAState,
  ResolveOsUpdatePathSteps,
} from "@api/device-action/OsUpdate/Resolve/types";
import { GetOsVersionError } from "@api/device-action/OsUpdate/Shared/OsUpdateDeviceActionErrors";
import { getOsVersion } from "@api/device-action/OsUpdate/Shared/Substeps/GetOsVersion";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";
import { type OsUpdate } from "@api/device-action/OsUpdate/Shared/types";

vi.mock("@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion");
vi.mock("@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard");
vi.mock("@api/device-action/OsUpdate/Shared/Substeps/GetOsVersion");
vi.mock("@api/device-action/OsUpdate/Resolve/Substeps/ResolveOsUpdatePath");

const pendingState = (
  step: ResolveOsUpdatePathSteps,
): ResolveOsUpdatePathDAState => ({
  status: DeviceActionStatus.Pending,
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step,
  },
});

const completedState = (output: OsUpdate[]): ResolveOsUpdatePathDAState => ({
  status: DeviceActionStatus.Completed,
  output,
});

const errorState = (
  error: ResolveOsUpdatePathDAError,
): ResolveOsUpdatePathDAState => ({
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

describe("ResolveOsUpdatePathDeviceAction", () => {
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

  const osUpdates = [
    {
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
    },
  ] satisfies OsUpdate[];

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

  const setupResolveOsUpdatePath = (
    result: Either<unknown, OsUpdate[]> = Right(osUpdates),
  ) =>
    vi
      .mocked(resolveOsUpdatePath)
      .mockReturnValue(
        () =>
          Promise.resolve(result) as ReturnType<
            ReturnType<typeof resolveOsUpdatePath>
          >,
      );

  const makeDeviceAction = () =>
    new ResolveOsUpdatePathDeviceAction({
      input: {
        unlockTimeout: 30_000,
      },
    });

  describe("Success", () => {
    it("Should complete the resolve flow when the device is already on dashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetOsVersion();
        setupResolveOsUpdatePath();

        const expectedStates: ResolveOsUpdatePathDAState[] = [
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.GetOsVersion),
          pendingState(ResolveOsUpdatePathSteps.ResolveOsUpdatePath),
          completedState(osUpdates),
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
        setupResolveOsUpdatePath();

        const expectedStates: ResolveOsUpdatePathDAState[] = [
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.GoToDashboard),
          pendingState(ResolveOsUpdatePathSteps.GoToDashboard),
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.GetOsVersion),
          pendingState(ResolveOsUpdatePathSteps.ResolveOsUpdatePath),
          completedState(osUpdates),
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

        const expectedStates: ResolveOsUpdatePathDAState[] = [
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
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

        const expectedStates: ResolveOsUpdatePathDAState[] = [
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.GoToDashboard),
          pendingState(ResolveOsUpdatePathSteps.GoToDashboard),
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
        setupResolveOsUpdatePath();

        const expectedStates: ResolveOsUpdatePathDAState[] = [
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.GetOsVersion),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("Should go to Error when resolveOsUpdatePath returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetOsVersion();
        const error = new ResolveOsUpdatePathError(
          new Error("manager api failed"),
        );
        setupResolveOsUpdatePath(Left(error));

        const expectedStates: ResolveOsUpdatePathDAState[] = [
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.WaitForAppAndVersion),
          pendingState(ResolveOsUpdatePathSteps.GetOsVersion),
          pendingState(ResolveOsUpdatePathSteps.ResolveOsUpdatePath),
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
