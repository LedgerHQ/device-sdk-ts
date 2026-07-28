import {
  DeviceActionStatus,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { type BackupApp } from "@api/device-action/OsUpdate/Backup/types";
import { RestoreAppsStorageDeviceAction } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceAction";
import {
  CommitRestoreAppStorageError,
  InitRestoreAppStorageError,
  RestoreAppStorageError,
} from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";
import { commitRestoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/CommitRestoreAppStorage";
import { initRestoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/InitRestoreAppStorage";
import { restoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/RestoreAppStorage";
import {
  InitRestoreAppStorageConsentResult,
  type RestoreAppsStorageDAError,
  type RestoreAppsStorageDAOutput,
  type RestoreAppsStorageDARequiredInteraction,
  type RestoreAppsStorageDAState,
  RestoreAppsStorageSteps,
} from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/types";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

vi.mock("@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion");
vi.mock("@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard");
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/InitRestoreAppStorage",
);
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/RestoreAppStorage",
);
vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/CommitRestoreAppStorage",
);

// ─── State builders ───────────────────────────────────────────────────────────

const pendingState = (
  step: RestoreAppsStorageSteps,
  requiredUserInteraction: RestoreAppsStorageDARequiredInteraction = UserInteractionRequired.None,
): RestoreAppsStorageDAState => ({
  status: DeviceActionStatus.Pending,
  intermediateValue: {
    requiredUserInteraction,
    step,
  },
});

const completedState = (
  output: RestoreAppsStorageDAOutput,
): RestoreAppsStorageDAState => ({
  status: DeviceActionStatus.Completed,
  output,
});

const errorState = (
  error: RestoreAppsStorageDAError,
): RestoreAppsStorageDAState => ({
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RestoreAppsStorageDeviceAction", () => {
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

  const setupInitRestoreAppStorage = (
    results: Either<
      InitRestoreAppStorageError,
      InitRestoreAppStorageConsentResult
    >[] = [Right(InitRestoreAppStorageConsentResult.GRANTED)],
  ) => {
    const queue = [...results];
    vi.mocked(initRestoreAppStorage).mockReturnValue(() =>
      Promise.resolve(
        queue.shift() ?? Right(InitRestoreAppStorageConsentResult.GRANTED),
      ),
    );
  };

  const setupRestoreAppStorage = (
    result: Either<RestoreAppStorageError, void> = Right(undefined),
  ) =>
    vi.mocked(restoreAppStorage).mockReturnValue(() => Promise.resolve(result));

  const setupCommitRestoreAppStorage = (
    result: Either<CommitRestoreAppStorageError, void> = Right(undefined),
  ) =>
    vi
      .mocked(commitRestoreAppStorage)
      .mockReturnValue(() => Promise.resolve(result));

  const makeDeviceAction = (
    backupApp: BackupApp[] = [],
    isMasterConsentGranted = false,
  ) =>
    new RestoreAppsStorageDeviceAction({
      input: {
        backupApps: backupApp,
        unlockTimeout: 30_000,
        isMasterConsentGranted,
      },
    });

  // ─── Success ────────────────────────────────────────────────────────────────

  describe("Success", () => {
    it("should restore storage for every app that has one, skipping apps without storage", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupInitRestoreAppStorage([
          Right(InitRestoreAppStorageConsentResult.GRANTED),
          Right(InitRestoreAppStorageConsentResult.GRANTED),
        ]);
        setupRestoreAppStorage();
        setupCommitRestoreAppStorage();

        const backupApp: BackupApp[] = [
          { appName: "AppWithStorage1", data: "0xaa" },
          { appName: "AppNoStorage", data: undefined },
          { appName: "AppWithStorage2", data: "0xbb" },
        ];

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(
            RestoreAppsStorageSteps.InitRestoreAppStorage,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreAppsStorageSteps.RestoreAppStorage),
          pendingState(RestoreAppsStorageSteps.CommitRestoreAppStorage),
          pendingState(
            RestoreAppsStorageSteps.InitRestoreAppStorage,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreAppsStorageSteps.RestoreAppStorage),
          pendingState(RestoreAppsStorageSteps.CommitRestoreAppStorage),
          completedState([
            { appName: "AppWithStorage1", restoredAppStorage: true },
            { appName: "AppWithStorage2", restoredAppStorage: true },
          ]),
        ];

        testDeviceActionStates(
          makeDeviceAction(backupApp),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should not require grant consent user interaction when isMasterConsentGranted is true", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupInitRestoreAppStorage([
          Right(InitRestoreAppStorageConsentResult.GRANTED),
        ]);
        setupRestoreAppStorage();
        setupCommitRestoreAppStorage();

        const backupApp: BackupApp[] = [
          { appName: "AppWithStorage1", data: "0xaa" },
        ];

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.InitRestoreAppStorage),
          pendingState(RestoreAppsStorageSteps.RestoreAppStorage),
          pendingState(RestoreAppsStorageSteps.CommitRestoreAppStorage),
          completedState([
            { appName: "AppWithStorage1", restoredAppStorage: true },
          ]),
        ];

        testDeviceActionStates(
          makeDeviceAction(backupApp, true),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should complete with an empty result when no app has storage to restore", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          completedState([]),
        ];

        testDeviceActionStates(
          makeDeviceAction([]),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to dashboard and wait for app and version again when an app is open", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionSequence(["Bitcoin", "BOLOS"]);
        setupGoToDashboard();

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.GoToDashboard),
          pendingState(RestoreAppsStorageSteps.GoToDashboard),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          completedState([]),
        ];

        testDeviceActionStates(
          makeDeviceAction([]),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should record restoredAppStorage: false and move on when consent is rejected", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupInitRestoreAppStorage([
          Right(InitRestoreAppStorageConsentResult.REJECTED),
        ]);
        setupRestoreAppStorage(); // registered in actors but never invoked (consent rejected)
        setupCommitRestoreAppStorage(); // registered in actors but never invoked (consent rejected)

        const backupApp: BackupApp[] = [
          { appName: "AppWithStorage1", data: "0xaa" },
        ];

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(
            RestoreAppsStorageSteps.InitRestoreAppStorage,
            UserInteractionRequired.GrantConsent,
          ),
          completedState([
            { appName: "AppWithStorage1", restoredAppStorage: false },
          ]),
        ];

        testDeviceActionStates(
          makeDeviceAction(backupApp),
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

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction([]),
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

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.GoToDashboard),
          pendingState(RestoreAppsStorageSteps.GoToDashboard),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction([]),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when initRestoreAppStorage fails with a fatal error", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        const error = new InitRestoreAppStorageError(
          new Error("command failed"),
        );
        setupInitRestoreAppStorage([Left(error)]);
        setupRestoreAppStorage(); // registered in actors but never invoked
        setupCommitRestoreAppStorage(); // registered in actors but never invoked

        const backupApp: BackupApp[] = [
          { appName: "AppWithStorage1", data: "0xaa" },
        ];

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(
            RestoreAppsStorageSteps.InitRestoreAppStorage,
            UserInteractionRequired.GrantConsent,
          ),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(backupApp),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when restoreAppStorage returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupInitRestoreAppStorage([
          Right(InitRestoreAppStorageConsentResult.GRANTED),
        ]);
        const error = new RestoreAppStorageError(new Error("chunk failed"));
        setupRestoreAppStorage(Left(error));
        setupCommitRestoreAppStorage(); // registered in actors but never invoked

        const backupApp: BackupApp[] = [
          { appName: "AppWithStorage1", data: "0xaa" },
        ];

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(
            RestoreAppsStorageSteps.InitRestoreAppStorage,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreAppsStorageSteps.RestoreAppStorage),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(backupApp),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when commitRestoreAppStorage returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupInitRestoreAppStorage([
          Right(InitRestoreAppStorageConsentResult.GRANTED),
        ]);
        setupRestoreAppStorage();
        const error = new CommitRestoreAppStorageError(
          new Error("commit failed"),
        );
        setupCommitRestoreAppStorage(Left(error));

        const backupApp: BackupApp[] = [
          { appName: "AppWithStorage1", data: "0xaa" },
        ];

        const expectedStates: RestoreAppsStorageDAState[] = [
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(RestoreAppsStorageSteps.WaitForAppAndVersion),
          pendingState(
            RestoreAppsStorageSteps.InitRestoreAppStorage,
            UserInteractionRequired.GrantConsent,
          ),
          pendingState(RestoreAppsStorageSteps.RestoreAppStorage),
          pendingState(RestoreAppsStorageSteps.CommitRestoreAppStorage),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(backupApp),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));
  });
});
