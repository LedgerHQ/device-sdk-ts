import {
  DeviceActionStatus,
  DeviceModelId,
  type TransportDeviceModel,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { CreateBackupDeviceAction } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceAction";
import {
  BackupAppsStorageError,
  GetLanguageIdError,
} from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";
import { backupAppsStorage } from "@api/device-action/OsUpdate/Backup/Substeps/BackupAppsStorage";
import { downloadCustomLockScreenDevice } from "@api/device-action/OsUpdate/Backup/Substeps/DownloadCustomLockScreen";
import { getIsOnboarded } from "@api/device-action/OsUpdate/Backup/Substeps/GetIsOnboarded";
import { getLanguageId } from "@api/device-action/OsUpdate/Backup/Substeps/GetLanguageId";
import { goToDashboard } from "@api/device-action/OsUpdate/Backup/Substeps/GoToDashboard";
import { listInstalledApps } from "@api/device-action/OsUpdate/Backup/Substeps/ListInstalledApps";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Backup/Substeps/WaitForAppAndVersion";
import {
  type Backup,
  type CreateBackupDAError,
  type CreateBackupDAState,
  CreateBackupSteps,
} from "@api/device-action/OsUpdate/Backup/types";

vi.mock("@api/device-action/OsUpdate/Backup/Substeps/GetLanguageId");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/GetIsOnboarded");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/GoToDashboard");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/ListInstalledApps");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/WaitForAppAndVersion");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/DownloadCustomLockScreen");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/BackupAppsStorage");

// ─── State builders ───────────────────────────────────────────────────────────

const pendingState = (step: CreateBackupSteps): CreateBackupDAState => ({
  status: DeviceActionStatus.Pending,
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step,
  },
});

const completedState = (
  output: Omit<Backup, "createdAt">,
): CreateBackupDAState => ({
  status: DeviceActionStatus.Completed,
  output: {
    ...output,
    createdAt: expect.any(Date) as Date,
  },
});

const errorState = (error: CreateBackupDAError): CreateBackupDAState => ({
  status: DeviceActionStatus.Error,
  error,
});

// ─── Mock actor factory ───────────────────────────────────────────────────────
//
// Creates a minimal XState machine that immediately completes (after 0 ms) with
// the given Either output.  The machine exposes the `intermediateValue` shape
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BackupDeviceAction", () => {
  const { getDeviceModel: getDeviceModelMock } =
    makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── Setup helpers ──────────────────────────────────────────────────────────

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

  const setupGoToDashboard = () =>
    vi
      .mocked(goToDashboard)
      .mockReturnValue(
        createMockActorMachine(Right(undefined)) as unknown as ReturnType<
          typeof goToDashboard
        >,
      );

  const setupGetIsOnboarded = (isDeviceOnboarded = true) =>
    vi
      .mocked(getIsOnboarded)
      .mockReturnValue(() => Promise.resolve(Right(isDeviceOnboarded)));

  const setupGetLanguageId = () =>
    vi.mocked(getLanguageId).mockReturnValue(() => Promise.resolve(Right(1)));

  const setupListInstalledApps = () =>
    vi.mocked(listInstalledApps).mockReturnValue(
      createMockActorMachine(
        Right({
          installedApps: [
            { name: "TestApp", hash: "abc", hash_code_data: "code", flags: 0 },
          ],
        }),
      ) as unknown as ReturnType<typeof listInstalledApps>,
    );

  const setupBackupAppsStorage = () =>
    vi
      .mocked(backupAppsStorage)
      .mockReturnValue(() =>
        Promise.resolve(Right([{ appName: "TestApp", data: "0xappData" }])),
      );

  const setupDownloadCls = () =>
    vi
      .mocked(downloadCustomLockScreenDevice)
      .mockReturnValue(
        createMockActorMachine(
          Right({ imageData: new Uint8Array([0x01, 0x02]), imageHash: "0102" }),
        ) as unknown as ReturnType<typeof downloadCustomLockScreenDevice>,
      );

  const setupStaxModel = () =>
    getDeviceModelMock.mockReturnValue({
      id: DeviceModelId.STAX,
    } as TransportDeviceModel);

  const setupNanoXModel = () =>
    getDeviceModelMock.mockReturnValue({
      id: DeviceModelId.NANO_X,
    } as TransportDeviceModel);

  const makeDeviceAction = () =>
    new CreateBackupDeviceAction({
      input: {
        unlockTimeout: 30_000,
      },
    });

  // ─── Success ────────────────────────────────────────────────────────────────

  describe("Success", () => {
    it("should complete the full backup flow for a CLS-supported device", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupGetIsOnboarded();
        setupGetLanguageId();
        setupListInstalledApps();
        setupBackupAppsStorage();
        setupDownloadCls();
        setupStaxModel();

        // State transitions:
        // GetLanguage → ListInstalledApps (×2: enter + onSnapshot)
        // → BackupAppsStorage → DownloadCustomLockScreen (×2: enter + onSnapshot) → Success
        const expectedStates: CreateBackupDAState[] = [
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GetIsOnboarded),
          pendingState(CreateBackupSteps.GetLanguage),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.BackupAppsStorage),
          pendingState(CreateBackupSteps.DownloadCustomLockScreen),
          pendingState(CreateBackupSteps.DownloadCustomLockScreen),
          completedState({
            languageId: 1,
            installedApps: [{ appName: "TestApp", data: "0xappData" }],
            clsHexImage: "0x0102",
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip ListInstalledApps and DownloadCustomLockScreen when device is unseeded", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupGetIsOnboarded(false);
        setupGetLanguageId();
        setupListInstalledApps(); // registered in actors but never invoked (always guard fires first)
        setupBackupAppsStorage(); // registered in actors but never invoked
        setupDownloadCls(); // registered in actors but never invoked

        // CheckIfDeviceIsOnboarded.isDeviceOnboarded false → jumps directly to Success
        const expectedStates: CreateBackupDAState[] = [
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GetIsOnboarded),
          pendingState(CreateBackupSteps.GetLanguage),
          completedState({
            languageId: 1,
            installedApps: [],
            clsHexImage: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip DownloadCustomLockScreen for devices that do not support CLS", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupGetIsOnboarded();
        setupGetLanguageId();
        setupListInstalledApps();
        setupBackupAppsStorage();
        setupDownloadCls(); // registered in actors but never invoked (always guard fires first)
        setupNanoXModel();

        // CheckIfDeviceSupportCustomLockScreenFeature.isCustomLockScreenFeatureSupported false → Success
        const expectedStates: CreateBackupDAState[] = [
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GetIsOnboarded),
          pendingState(CreateBackupSteps.GetLanguage),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.BackupAppsStorage),
          completedState({
            languageId: 1,
            installedApps: [{ appName: "TestApp", data: "0xappData" }],
            clsHexImage: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
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
        setupGetLanguageId();
        setupListInstalledApps();
        setupBackupAppsStorage();
        setupDownloadCls(); // registered in actors but never invoked (always guard fires first)
        setupNanoXModel();

        const expectedStates: CreateBackupDAState[] = [
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GoToDashboard),
          pendingState(CreateBackupSteps.GoToDashboard),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GetIsOnboarded),
          pendingState(CreateBackupSteps.GetLanguage),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.BackupAppsStorage),
          completedState({
            languageId: 1,
            installedApps: [{ appName: "TestApp", data: "0xappData" }],
            clsHexImage: undefined,
          }),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));
  });

  // ─── Error ──────────────────────────────────────────────────────────────────

  describe("Error", () => {
    it("should go to Error when getLanguageId returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupGetIsOnboarded();
        setupListInstalledApps(); // registered in actors but never invoked (always hasError guard fires first)
        const error = new GetLanguageIdError(new Error("command failed"));
        vi.mocked(getLanguageId).mockReturnValue(() =>
          Promise.resolve(Left(error)),
        );

        // getLanguageId Left → CheckIfDeviceIsOnboarded.hasError → Error
        const expectedStates: CreateBackupDAState[] = [
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GetIsOnboarded),
          pendingState(CreateBackupSteps.GetLanguage),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when listInstalledApps returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupGetIsOnboarded();
        setupGetLanguageId();
        const error = new UnknownDAError("listInstalledApps failed");
        vi.mocked(listInstalledApps).mockReturnValue(
          createMockActorMachine(Left(error)) as unknown as ReturnType<
            typeof listInstalledApps
          >,
        );

        // listInstalledApps Left → BackupAppsStorage.always hasError → Error
        const expectedStates: CreateBackupDAState[] = [
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GetIsOnboarded),
          pendingState(CreateBackupSteps.GetLanguage),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.ListInstalledApps),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when backupAppsStorage returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupGetIsOnboarded();
        setupGetLanguageId();
        setupListInstalledApps();
        setupDownloadCls(); // registered in actors but never invoked (always hasError guard fires first)
        const error = new BackupAppsStorageError(new Error("storage failed"));
        vi.mocked(backupAppsStorage).mockReturnValue(() =>
          Promise.resolve(Left(error)),
        );

        // backupAppsStorage Left → CheckIfDeviceSupportCustomLockScreenFeature.hasError → Error
        const expectedStates: CreateBackupDAState[] = [
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GetIsOnboarded),
          pendingState(CreateBackupSteps.GetLanguage),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.BackupAppsStorage),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when downloadCustomLockScreenDevice returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupGoToDashboard();
        setupGetIsOnboarded();
        setupGetLanguageId();
        setupListInstalledApps();
        setupBackupAppsStorage();
        setupStaxModel();
        const error = new UnknownDAError("downloadCLS failed");
        vi.mocked(downloadCustomLockScreenDevice).mockReturnValue(
          createMockActorMachine(Left(error)) as unknown as ReturnType<
            typeof downloadCustomLockScreenDevice
          >,
        );

        // downloadCustomLockScreen Left → CheckDownloadCustomLockScreen.hasError → Error
        const expectedStates: CreateBackupDAState[] = [
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.WaitForAppAndVersion),
          pendingState(CreateBackupSteps.GetIsOnboarded),
          pendingState(CreateBackupSteps.GetLanguage),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.ListInstalledApps),
          pendingState(CreateBackupSteps.BackupAppsStorage),
          pendingState(CreateBackupSteps.DownloadCustomLockScreen),
          pendingState(CreateBackupSteps.DownloadCustomLockScreen),
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
