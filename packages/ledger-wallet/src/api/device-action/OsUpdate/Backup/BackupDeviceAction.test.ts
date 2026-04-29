import {
  DeviceActionStatus,
  DeviceModelId,
  type TransportDeviceModel,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type KeyValueStorage } from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { BackupDeviceAction } from "@api/device-action/OsUpdate/Backup/BackupDeviceAction";
import {
  BackupAppsStorageError,
  GetLanguageIdError,
  LookForBackupError,
  SaveBackupError,
} from "@api/device-action/OsUpdate/Backup/BackupDeviceActionErrors";
import { backupAppsStorage } from "@api/device-action/OsUpdate/Backup/Substeps/BackupAppsStorage";
import { downloadCustomLockScreenDevice } from "@api/device-action/OsUpdate/Backup/Substeps/DownloadCustomLockScreen";
import { getLanguageId } from "@api/device-action/OsUpdate/Backup/Substeps/GetLanguageId";
import { listInstalledApps } from "@api/device-action/OsUpdate/Backup/Substeps/ListInstalledApps";
import { lookForBackup } from "@api/device-action/OsUpdate/Backup/Substeps/LookForBackup";
import { saveBackup } from "@api/device-action/OsUpdate/Backup/Substeps/SaveBackup";
import {
  type BackupDAError,
  type BackupDAState,
  BackupSteps,
} from "@api/device-action/OsUpdate/Backup/types";

vi.mock("@api/device-action/OsUpdate/Backup/Substeps/LookForBackup");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/GetLanguageId");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/ListInstalledApps");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/DownloadCustomLockScreen");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/BackupAppsStorage");
vi.mock("@api/device-action/OsUpdate/Backup/Substeps/SaveBackup");

// ─── State builders ───────────────────────────────────────────────────────────

const pendingState = (step: BackupSteps): BackupDAState => ({
  status: DeviceActionStatus.Pending,
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step,
  },
});

const completedState = (): BackupDAState => ({
  status: DeviceActionStatus.Completed,
  output: undefined,
});

const errorState = (error: BackupDAError): BackupDAState => ({
  status: DeviceActionStatus.Error,
  error,
});

// ─── Mock actor factory ───────────────────────────────────────────────────────
//
// Creates a minimal XState machine that immediately completes (after 0 ms) with
// the given Either output.  The machine exposes the `intermediateValue` shape
// required by the parent's `onSnapshot` handler.

const createMockActorMachine = (output: Either<unknown, unknown>) =>
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
    output: () => output,
  });

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEVICE_ID = "device123";

const storage: KeyValueStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BackupDeviceAction", () => {
  const { getDeviceModel: getDeviceModelMock } =
    makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── Setup helpers ──────────────────────────────────────────────────────────

  const setupNoExistingBackup = () =>
    vi
      .mocked(lookForBackup)
      .mockReturnValue(() => Promise.resolve(Right(false)));

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
        Promise.resolve(Right([{ appName: "TestApp", data: "appData" }])),
      );

  const setupDownloadCls = () =>
    vi
      .mocked(downloadCustomLockScreenDevice)
      .mockReturnValue(
        createMockActorMachine(
          Right({ imageData: new Uint8Array([0x01, 0x02]), imageHash: "0102" }),
        ) as unknown as ReturnType<typeof downloadCustomLockScreenDevice>,
      );

  const setupSaveBackup = () =>
    vi
      .mocked(saveBackup)
      .mockReturnValue(() => Promise.resolve(Right(undefined)));

  const setupStaxModel = () =>
    getDeviceModelMock.mockReturnValue({
      id: DeviceModelId.STAX,
    } as TransportDeviceModel);

  const setupNanoXModel = () =>
    getDeviceModelMock.mockReturnValue({
      id: DeviceModelId.NANO_X,
    } as TransportDeviceModel);

  const makeDeviceAction = (isDeviceOnboarded = true) =>
    new BackupDeviceAction({
      input: {
        isDeviceOnboarded,
        deviceId: DEVICE_ID,
        storage,
        unlockTimeout: 30_000,
      },
    });

  // ─── Success ────────────────────────────────────────────────────────────────

  describe("Success", () => {
    it("should complete the full backup flow for a CLS-supported device", () =>
      new Promise<void>((resolve, reject) => {
        setupNoExistingBackup();
        setupGetLanguageId();
        setupListInstalledApps();
        setupBackupAppsStorage();
        setupDownloadCls();
        setupSaveBackup();
        setupStaxModel();

        // State transitions:
        // GetBackupIfExist → GetLanguage → ListInstalledApps (×2: enter + onSnapshot)
        // → BackupAppsStorage → DownloadCustomLockScreen (×2: enter + onSnapshot)
        // → SaveBackup → Success
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          pendingState(BackupSteps.GetLanguage),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.BackupAppsStorage),
          pendingState(BackupSteps.DownloadCustomLockScreen),
          pendingState(BackupSteps.DownloadCustomLockScreen),
          pendingState(BackupSteps.SaveBackup),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should complete immediately when a valid backup already exists", () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(lookForBackup).mockReturnValue(() =>
          Promise.resolve(Right(true)),
        );

        // CheckIfBackupExist.hasBackup → immediately transitions to Success
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          completedState(),
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
        setupNoExistingBackup();
        setupGetLanguageId();
        setupListInstalledApps(); // registered in actors but never invoked (always guard fires first)
        setupBackupAppsStorage(); // registered in actors but never invoked
        setupDownloadCls(); // registered in actors but never invoked
        setupSaveBackup();

        // ListInstalledApps.always isDeviceUnseeded → jumps directly to SaveBackup
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          pendingState(BackupSteps.GetLanguage),
          pendingState(BackupSteps.SaveBackup),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(false /* isDeviceOnboarded */),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip DownloadCustomLockScreen for devices that do not support CLS", () =>
      new Promise<void>((resolve, reject) => {
        setupNoExistingBackup();
        setupGetLanguageId();
        setupListInstalledApps();
        setupBackupAppsStorage();
        setupDownloadCls(); // registered in actors but never invoked (always guard fires first)
        setupSaveBackup();
        setupNanoXModel();

        // DownloadCustomLockScreen.always isCustomLockScreenFeatureNotSupported → SaveBackup
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          pendingState(BackupSteps.GetLanguage),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.BackupAppsStorage),
          pendingState(BackupSteps.SaveBackup),
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

  // ─── Error ──────────────────────────────────────────────────────────────────

  describe("Error", () => {
    it("should go to Error when lookForBackup returns Left", () =>
      new Promise<void>((resolve, reject) => {
        const error = new LookForBackupError(new Error("data storage failed"));
        vi.mocked(lookForBackup).mockReturnValue(() =>
          Promise.resolve(Left(error)),
        );

        // CheckIfBackupExist.hasError → Error
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when lookForBackup promise rejects", () =>
      new Promise<void>((resolve, reject) => {
        const thrownError = new Error("unexpected crash");
        vi.mocked(lookForBackup).mockReturnValue(() =>
          Promise.reject(thrownError),
        );

        // onError → assignErrorFromEvent → Error
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          errorState(thrownError as unknown as BackupDAError),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when getLanguageId returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupNoExistingBackup();
        setupListInstalledApps(); // registered in actors but never invoked (always hasError guard fires first)
        const error = new GetLanguageIdError(new Error("command failed"));
        vi.mocked(getLanguageId).mockReturnValue(() =>
          Promise.resolve(Left(error)),
        );

        // getLanguageId Left → ListInstalledApps.always hasError → Error
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          pendingState(BackupSteps.GetLanguage),
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
        setupNoExistingBackup();
        setupGetLanguageId();
        const error = new UnknownDAError("listInstalledApps failed");
        vi.mocked(listInstalledApps).mockReturnValue(
          createMockActorMachine(Left(error)) as unknown as ReturnType<
            typeof listInstalledApps
          >,
        );

        // listInstalledApps Left → BackupAppsStorage.always hasError → Error
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          pendingState(BackupSteps.GetLanguage),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.ListInstalledApps),
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
        setupNoExistingBackup();
        setupGetLanguageId();
        setupListInstalledApps();
        setupDownloadCls(); // registered in actors but never invoked (always hasError guard fires first)
        const error = new BackupAppsStorageError(new Error("storage failed"));
        vi.mocked(backupAppsStorage).mockReturnValue(() =>
          Promise.resolve(Left(error)),
        );

        // backupAppsStorage Left → DownloadCustomLockScreen.always hasError → Error
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          pendingState(BackupSteps.GetLanguage),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.BackupAppsStorage),
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
        setupNoExistingBackup();
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

        // downloadCustomLockScreen Left → SaveBackup.always hasError → Error
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          pendingState(BackupSteps.GetLanguage),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.BackupAppsStorage),
          pendingState(BackupSteps.DownloadCustomLockScreen),
          pendingState(BackupSteps.DownloadCustomLockScreen),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when saveBackup returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupNoExistingBackup();
        setupGetLanguageId();
        setupListInstalledApps();
        setupBackupAppsStorage();
        setupDownloadCls();
        setupStaxModel();
        const error = new SaveBackupError(new Error("save failed"));
        vi.mocked(saveBackup).mockReturnValue(() =>
          Promise.resolve(Left(error)),
        );

        // saveBackup Left → CheckSaveBackup.always hasError → Error
        const expectedStates: BackupDAState[] = [
          pendingState(BackupSteps.Idle),
          pendingState(BackupSteps.GetLanguage),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.ListInstalledApps),
          pendingState(BackupSteps.BackupAppsStorage),
          pendingState(BackupSteps.DownloadCustomLockScreen),
          pendingState(BackupSteps.DownloadCustomLockScreen),
          pendingState(BackupSteps.SaveBackup),
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
