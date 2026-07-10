import {
  DeviceActionStatus,
  DeviceModelId,
  RefusedByUserDAError,
  type TransportDeviceModel,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { type Backup } from "@api/device-action/OsUpdate/Backup/types";
import { RestoreBackupDeviceAction } from "@api/device-action/OsUpdate/Restore/RestoreBackup/RestoreBackupDeviceAction";
import {
  GetIsOnboardedError,
  RequestMasterConsentError,
} from "@api/device-action/OsUpdate/Restore/RestoreBackup/RestoreBackupDeviceActionErrors";
import { getIsOnboarded } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/GetIsOnboarded";
import { installLanguagePackage } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/InstallLanguagePackage";
import { installOrUpdateApps } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/InstallOrUpdateApps";
import { requestMasterConsent } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/RequestMasterConsent";
import { restoreAppsStorage } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/RestoreAppsStorage";
import { uploadCustomLockScreenDevice } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/UploadCustomLockScreen";
import {
  RequestMasterConsentResult,
  type RestoreBackupDAError,
  type RestoreBackupDAOutput,
  type RestoreBackupDARequiredInteraction,
  type RestoreBackupDAState,
  RestoreBackupSteps,
} from "@api/device-action/OsUpdate/Restore/RestoreBackup/types";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

vi.mock("@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion");
vi.mock("@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard");
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/GetIsOnboarded",
);
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/RequestMasterConsent",
);
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/InstallLanguagePackage",
);
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/InstallOrUpdateApps",
);
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/RestoreAppsStorage",
);
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/UploadCustomLockScreen",
);

// ─── State builders ───────────────────────────────────────────────────────────

const pendingState = (
  step: RestoreBackupSteps,
  requiredUserInteraction: RestoreBackupDARequiredInteraction = UserInteractionRequired.None,
): RestoreBackupDAState => ({
  status: DeviceActionStatus.Pending,
  intermediateValue: {
    requiredUserInteraction,
    step,
  },
});

const completedState = (
  output: RestoreBackupDAOutput,
): RestoreBackupDAState => ({
  status: DeviceActionStatus.Completed,
  output,
});

const errorState = (error: RestoreBackupDAError): RestoreBackupDAState => ({
  status: DeviceActionStatus.Error,
  error,
});

// ─── Mock actor factory ───────────────────────────────────────────────────────
//
// Creates a minimal XState machine that immediately completes (after 0 ms) with
// the given Either output. The machine exposes the `intermediateValue` shape
// required by the parent's `onSnapshot` handler.

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeBackup = (overrides: Partial<Backup> = {}): Backup => ({
  languageId: undefined,
  installedApps: [],
  clsHexImage: undefined,
  createdAt: new Date(),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RestoreBackupDeviceAction", () => {
  const { getDeviceModel: getDeviceModelMock } =
    makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── Setup helpers ──────────────────────────────────────────────────────────

  const setupWaitForAppAndVersion = (appName = "BOLOS") =>
    vi
      .mocked(waitForAppAndVersion)
      .mockReturnValue(
        createMockActorMachine(
          Right({ name: appName, version: "1.0.0" }),
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

  const setupGetIsOnboarded = (
    result: Either<unknown, { isDeviceOnboarded: boolean }> = Right({
      isDeviceOnboarded: true,
    }),
  ) =>
    vi
      .mocked(getIsOnboarded)
      .mockReturnValue(
        () =>
          Promise.resolve(result) as ReturnType<
            ReturnType<typeof getIsOnboarded>
          >,
      );

  const setupRequestMasterConsent = (
    result: Either<unknown, RequestMasterConsentResult> = Right(
      RequestMasterConsentResult.GRANTED,
    ),
  ) =>
    vi
      .mocked(requestMasterConsent)
      .mockReturnValue(
        () =>
          Promise.resolve(result) as ReturnType<
            ReturnType<typeof requestMasterConsent>
          >,
      );

  const setupInstallLanguagePackage = (
    output: Either<unknown, unknown> = Right(undefined),
  ) =>
    vi
      .mocked(installLanguagePackage)
      .mockReturnValue(
        createMockActorMachine(output) as unknown as ReturnType<
          typeof installLanguagePackage
        >,
      );

  const setupInstallOrUpdateApps = (
    output: Either<unknown, unknown> = Right({
      successfullyInstalled: [],
      alreadyInstalled: [],
      missingApplications: [],
    }),
  ) =>
    vi
      .mocked(installOrUpdateApps)
      .mockReturnValue(
        createMockActorMachine(output) as unknown as ReturnType<
          typeof installOrUpdateApps
        >,
      );

  const setupRestoreAppsStorage = (
    output: Either<unknown, unknown> = Right([]),
  ) =>
    vi
      .mocked(restoreAppsStorage)
      .mockReturnValue(
        createMockActorMachine(output) as unknown as ReturnType<
          typeof restoreAppsStorage
        >,
      );

  const setupUploadCustomLockScreen = (
    output: Either<unknown, unknown> = Right(undefined),
  ) =>
    vi
      .mocked(uploadCustomLockScreenDevice)
      .mockReturnValue(
        createMockActorMachine(output) as unknown as ReturnType<
          typeof uploadCustomLockScreenDevice
        >,
      );

  const setupDeviceModel = (id: DeviceModelId) =>
    getDeviceModelMock.mockReturnValue({ id } as TransportDeviceModel);

  const makeDeviceAction = (backup: Backup = makeBackup()) =>
    new RestoreBackupDeviceAction({
      input: { backup, unlockTimeout: 30_000 },
    });

  // ─── Success ────────────────────────────────────────────────────────────────

  describe("Success", () => {
    it("should complete the full restore flow when everything succeeds", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        setupInstallLanguagePackage();
        setupInstallOrUpdateApps(
          Right({
            successfullyInstalled: [{ versionName: "App1" }],
            alreadyInstalled: [],
            missingApplications: [],
          }),
        );
        setupRestoreAppsStorage(
          Right([{ appName: "App1", restoredAppStorage: true }]),
        );
        setupUploadCustomLockScreen();

        const backup = makeBackup({
          languageId: 1, // french
          installedApps: [{ appName: "App1", data: "0xaa" }],
          clsHexImage: "0x0102",
        });

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreBackupSteps.InstallLanguagePackage),
          pendingState(RestoreBackupSteps.InstallLanguagePackage),
          pendingState(RestoreBackupSteps.InstallOrUpdateApps),
          pendingState(RestoreBackupSteps.InstallOrUpdateApps),
          pendingState(RestoreBackupSteps.RestoreAppsStorage),
          pendingState(RestoreBackupSteps.RestoreAppsStorage),
          pendingState(RestoreBackupSteps.UploadCustomLockScreen),
          pendingState(RestoreBackupSteps.UploadCustomLockScreen),
          completedState({
            restoredLanguage: true,
            restoredCLS: true,
            restoredApps: [
              { appName: "App1", restoredApp: true, restoredAppStorage: true },
            ],
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to dashboard and wait for app and version again when an app is open", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionSequence(["Bitcoin", "BOLOS"]);
        setupGoToDashboard();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.NANO_X);

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GoToDashboard),
          pendingState(RestoreBackupSteps.GoToDashboard),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          completedState({
            restoredLanguage: undefined,
            restoredCLS: undefined,
            restoredApps: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should still restore the language pack but skip app/storage/CLS steps when device is not onboarded", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded(Right({ isDeviceOnboarded: false }));
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        setupInstallLanguagePackage();

        const backup = makeBackup({
          languageId: 1, // french
          installedApps: [{ appName: "App1", data: "0xaa" }],
          clsHexImage: "0x0102",
        });

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreBackupSteps.InstallLanguagePackage),
          pendingState(RestoreBackupSteps.InstallLanguagePackage),
          completedState({
            restoredLanguage: true,
            restoredCLS: false,
            restoredApps: [
              {
                appName: "App1",
                restoredApp: false,
                restoredAppStorage: false,
              },
            ],
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip RequestMasterConsent when the device does not support the feature", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.NANO_X);
        setupRequestMasterConsent(); // registered but never invoked

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          completedState({
            restoredLanguage: undefined,
            restoredCLS: undefined,
            restoredApps: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should stop and complete immediately when master consent is rejected by the user", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent(Right(RequestMasterConsentResult.REJECTED));
        setupInstallLanguagePackage(); // registered but never invoked

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          completedState({
            restoredLanguage: undefined,
            restoredCLS: undefined,
            restoredApps: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip InstallOrUpdateApps and RestoreAppsStorage when the backup has no app", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        setupUploadCustomLockScreen();
        setupInstallOrUpdateApps(); // registered but never invoked
        setupRestoreAppsStorage(); // registered but never invoked

        const backup = makeBackup({ clsHexImage: "0x0102" });

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreBackupSteps.UploadCustomLockScreen),
          pendingState(RestoreBackupSteps.UploadCustomLockScreen),
          completedState({
            restoredLanguage: undefined,
            restoredCLS: true,
            restoredApps: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip UploadCustomLockScreen when the device does not support the feature, even if a CLS was backed up", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.NANO_X);
        setupUploadCustomLockScreen(); // registered but never invoked

        const backup = makeBackup({ clsHexImage: "0x0102" });

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          completedState({
            restoredLanguage: undefined,
            restoredCLS: false,
            restoredApps: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip UploadCustomLockScreen when no CLS was backed up, even on a supported device", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        setupUploadCustomLockScreen(); // registered but never invoked

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          completedState({
            restoredLanguage: undefined,
            restoredCLS: undefined,
            restoredApps: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should not fail and should keep going when the user refuses the language pack, app install, and CLS upload prompts", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        setupInstallLanguagePackage(Left(new RefusedByUserDAError()));
        setupInstallOrUpdateApps(Left(new RefusedByUserDAError()));
        setupRestoreAppsStorage(Right([]));
        setupUploadCustomLockScreen(Left(new RefusedByUserDAError()));

        const backup = makeBackup({
          languageId: 1, // french
          installedApps: [{ appName: "App1", data: "0xaa" }],
          clsHexImage: "0x0102",
        });

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreBackupSteps.InstallLanguagePackage),
          pendingState(RestoreBackupSteps.InstallLanguagePackage),
          pendingState(RestoreBackupSteps.InstallOrUpdateApps),
          pendingState(RestoreBackupSteps.InstallOrUpdateApps),
          pendingState(RestoreBackupSteps.RestoreAppsStorage),
          pendingState(RestoreBackupSteps.RestoreAppsStorage),
          pendingState(RestoreBackupSteps.UploadCustomLockScreen),
          pendingState(RestoreBackupSteps.UploadCustomLockScreen),
          completedState({
            restoredLanguage: false,
            restoredCLS: false,
            restoredApps: [
              {
                appName: "App1",
                restoredApp: false,
                restoredAppStorage: false,
              },
            ],
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));
  });

  // ─── Error ──────────────────────────────────────────────────────────────────

  describe("Error", () => {
    it("should go to Error when waitForAppAndVersion returns Left", () =>
      new Promise<void>((resolve, reject) => {
        const error = new UnknownDAError("waitForAppAndVersion failed");
        vi.mocked(waitForAppAndVersion).mockReturnValue(
          createMockActorMachine(Left(error)) as unknown as ReturnType<
            typeof waitForAppAndVersion
          >,
        );

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when goToDashboard returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion("Bitcoin");
        const error = new UnknownDAError("goToDashboard failed");
        setupGoToDashboard(Left(error));

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GoToDashboard),
          pendingState(RestoreBackupSteps.GoToDashboard),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when getIsOnboarded returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        const error = new GetIsOnboardedError(new Error("command failed"));
        setupGetIsOnboarded(Left(error));

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when requestMasterConsent fails with a fatal (non-refusal) error", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        const error = new RequestMasterConsentError(
          new Error("command failed"),
        );
        setupRequestMasterConsent(Left(error));

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when installLanguagePackage fails with a fatal (non-refusal) error", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        const error = new UnknownDAError("installLanguagePackage failed");
        setupInstallLanguagePackage(Left(error));

        const backup = makeBackup({ languageId: 1 }); // french

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreBackupSteps.InstallLanguagePackage),
          pendingState(RestoreBackupSteps.InstallLanguagePackage),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when installOrUpdateApps fails with a fatal (non-refusal) error", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        const error = new UnknownDAError("installOrUpdateApps failed");
        setupInstallOrUpdateApps(Left(error));

        const backup = makeBackup({
          installedApps: [{ appName: "App1", data: "0xaa" }],
        });

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreBackupSteps.InstallOrUpdateApps),
          pendingState(RestoreBackupSteps.InstallOrUpdateApps),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when restoreAppsStorage returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        setupInstallOrUpdateApps(
          Right({
            successfullyInstalled: [{ versionName: "App1" }],
            alreadyInstalled: [],
            missingApplications: [],
          }),
        );
        const error = new UnknownDAError("restoreAppsStorage failed");
        setupRestoreAppsStorage(Left(error));

        const backup = makeBackup({
          installedApps: [{ appName: "App1", data: "0xaa" }],
        });

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreBackupSteps.InstallOrUpdateApps),
          pendingState(RestoreBackupSteps.InstallOrUpdateApps),
          pendingState(RestoreBackupSteps.RestoreAppsStorage),
          pendingState(RestoreBackupSteps.RestoreAppsStorage),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when uploadCustomLockScreen fails with a fatal (non-refusal) error", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGetIsOnboarded();
        setupDeviceModel(DeviceModelId.STAX);
        setupRequestMasterConsent();
        const error = new UnknownDAError("uploadCustomLockScreen failed");
        setupUploadCustomLockScreen(Left(error));

        const backup = makeBackup({ clsHexImage: "0x0102" });

        const expectedStates: RestoreBackupDAState[] = [
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.WaitForAppAndVersion),
          pendingState(RestoreBackupSteps.GetIsOnboarded),
          pendingState(
            RestoreBackupSteps.RequestMasterConsent,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreBackupSteps.UploadCustomLockScreen),
          pendingState(RestoreBackupSteps.UploadCustomLockScreen),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(backup),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));
  });
});
