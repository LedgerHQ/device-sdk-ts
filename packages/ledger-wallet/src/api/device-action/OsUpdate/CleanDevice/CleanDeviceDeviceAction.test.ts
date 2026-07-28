import {
  DeleteLanguagePackDAError,
  DeviceActionStatus,
  DeviceModelId,
  type InstalledApp,
  type TransportDeviceModel,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { CleanDeviceDeviceAction } from "@api/device-action/OsUpdate/CleanDevice/CleanDeviceDeviceAction";
import { deleteLanguagePack } from "@api/device-action/OsUpdate/CleanDevice/Substeps/DeleteLanguagePack";
import { getCustomLockScreenInfo } from "@api/device-action/OsUpdate/CleanDevice/Substeps/GetCustomLockScreenInfo";
import { removeCustomLockScreen } from "@api/device-action/OsUpdate/CleanDevice/Substeps/RemoveCustomLockScreen";
import { uninstallApp } from "@api/device-action/OsUpdate/CleanDevice/Substeps/UninstallApp";
import {
  type CleanDeviceDAError,
  type CleanDeviceDAState,
  CleanDeviceSteps,
} from "@api/device-action/OsUpdate/CleanDevice/types";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { listInstalledApps } from "@api/device-action/OsUpdate/Shared/Substeps/ListInstalledApps";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

vi.mock("@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard");
vi.mock("@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion");
vi.mock("@api/device-action/OsUpdate/Shared/Substeps/ListInstalledApps");
vi.mock("@api/device-action/OsUpdate/CleanDevice/Substeps/UninstallApp");
vi.mock("@api/device-action/OsUpdate/CleanDevice/Substeps/DeleteLanguagePack");
vi.mock(
  "@api/device-action/OsUpdate/CleanDevice/Substeps/GetCustomLockScreenInfo",
);
vi.mock(
  "@api/device-action/OsUpdate/CleanDevice/Substeps/RemoveCustomLockScreen",
);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeInstalledApp = (name: string): InstalledApp => ({
  flags: 0,
  hash: `hash-${name}`,
  hash_code_data: `code-${name}`,
  name,
});

// ─── State builders ───────────────────────────────────────────────────────────

const pendingState = (step: CleanDeviceSteps): CleanDeviceDAState => ({
  status: DeviceActionStatus.Pending,
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step,
  },
});

const completedState = (): CleanDeviceDAState => ({
  status: DeviceActionStatus.Completed,
  output: undefined,
});

const errorState = (error: CleanDeviceDAError): CleanDeviceDAState => ({
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

describe("CleanDeviceDeviceAction", () => {
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

  const setupListInstalledApps = (
    output: Either<unknown, unknown> = Right({ installedApps: [] }),
  ) =>
    vi
      .mocked(listInstalledApps)
      .mockReturnValue(
        createMockActorMachine(output) as unknown as ReturnType<
          typeof listInstalledApps
        >,
      );

  const setupUninstallApp = (
    results: Either<unknown, unknown>[] = [Right(undefined)],
  ) => {
    const queue = [...results];
    vi.mocked(uninstallApp).mockReturnValue(
      createMockActorMachineFromOutput(
        () => queue.shift() ?? Right(undefined),
      ) as unknown as ReturnType<typeof uninstallApp>,
    );
  };

  const setupDeleteLanguagePack = (
    result: Either<DeleteLanguagePackDAError, void> = Right(undefined),
  ) =>
    vi
      .mocked(deleteLanguagePack)
      .mockReturnValue(() => Promise.resolve(result));

  const setupGetCustomLockScreenInfo = (
    output: Either<unknown, unknown> = Right({ hasCustomLockScreen: true }),
  ) =>
    vi
      .mocked(getCustomLockScreenInfo)
      .mockReturnValue(
        createMockActorMachine(output) as unknown as ReturnType<
          typeof getCustomLockScreenInfo
        >,
      );

  const setupRemoveCustomLockScreen = (
    output: Either<unknown, unknown> = Right(undefined),
  ) =>
    vi
      .mocked(removeCustomLockScreen)
      .mockReturnValue(
        createMockActorMachine(output) as unknown as ReturnType<
          typeof removeCustomLockScreen
        >,
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
    new CleanDeviceDeviceAction({
      input: { unlockTimeout: 30_000 },
    });

  // ─── Success ────────────────────────────────────────────────────────────────

  describe("Success", () => {
    it("should uninstall every app, delete the language pack and remove the CLS on a CLS-supported device", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps(
          Right({
            installedApps: [makeInstalledApp("App1"), makeInstalledApp("App2")],
          }),
        );
        setupUninstallApp([Right(undefined), Right(undefined)]);
        setupDeleteLanguagePack();
        setupStaxModel();
        setupGetCustomLockScreenInfo();
        setupRemoveCustomLockScreen();

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.UninstallApps),
          pendingState(CleanDeviceSteps.UninstallApps),
          pendingState(CleanDeviceSteps.UninstallApps),
          pendingState(CleanDeviceSteps.UninstallApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          pendingState(CleanDeviceSteps.RemoveCustomLockScreen),
          pendingState(CleanDeviceSteps.RemoveCustomLockScreen),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should filter out apps with an empty name before uninstalling", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps(
          Right({
            installedApps: [makeInstalledApp(""), makeInstalledApp("App1")],
          }),
        );
        setupUninstallApp([Right(undefined)]);
        setupDeleteLanguagePack();
        setupNanoXModel();

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.UninstallApps),
          pendingState(CleanDeviceSteps.UninstallApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip the uninstall loop when there are no installed apps", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps();
        setupUninstallApp(); // registered in actors but never invoked
        setupDeleteLanguagePack();
        setupStaxModel();
        setupGetCustomLockScreenInfo();
        setupRemoveCustomLockScreen();

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          pendingState(CleanDeviceSteps.RemoveCustomLockScreen),
          pendingState(CleanDeviceSteps.RemoveCustomLockScreen),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip RemoveCustomLockScreen for devices that do not support the feature", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps();
        setupDeleteLanguagePack();
        setupNanoXModel();
        setupRemoveCustomLockScreen(); // registered in actors but never invoked

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
          completedState(),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should skip RemoveCustomLockScreen when the device has no custom lock screen to remove", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps();
        setupDeleteLanguagePack();
        setupStaxModel();
        setupGetCustomLockScreenInfo(Right({ hasCustomLockScreen: false }));
        setupRemoveCustomLockScreen(); // registered in actors but never invoked

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          completedState(),
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
        setupListInstalledApps();
        setupDeleteLanguagePack();
        setupNanoXModel();

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.GoToDashboard),
          pendingState(CleanDeviceSteps.GoToDashboard),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
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
    it("should go to Error when waitForAppAndVersion returns Left", () =>
      new Promise<void>((resolve, reject) => {
        const error = new UnknownDAError("waitForAppAndVersion failed");
        vi.mocked(waitForAppAndVersion).mockReturnValue(
          createMockActorMachine(Left(error)) as unknown as ReturnType<
            typeof waitForAppAndVersion
          >,
        );

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
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

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.GoToDashboard),
          pendingState(CleanDeviceSteps.GoToDashboard),
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
        const error = new UnknownDAError("listInstalledApps failed");
        setupListInstalledApps(Left(error));

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should abort immediately when uninstalling an app fails, without uninstalling the remaining apps", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps(
          Right({
            installedApps: [makeInstalledApp("App1"), makeInstalledApp("App2")],
          }),
        );
        const error = new UnknownDAError("uninstallApp failed");
        setupUninstallApp([Left(error), Right(undefined)]);

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.UninstallApps),
          pendingState(CleanDeviceSteps.UninstallApps),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when deleteLanguagePack returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps();
        const error = new DeleteLanguagePackDAError("Invalid LANG_ID value.");
        setupDeleteLanguagePack(Left(error));

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when getCustomLockScreenInfo returns Left", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps();
        setupDeleteLanguagePack();
        setupStaxModel();
        const error = new UnknownDAError("getCustomLockScreenInfo failed");
        setupGetCustomLockScreenInfo(Left(error));
        setupRemoveCustomLockScreen(); // registered in actors but never invoked

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          errorState(error),
        ];

        testDeviceActionStates(
          makeDeviceAction(),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should go to Error when removeCustomLockScreen fails", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersion();
        setupListInstalledApps();
        setupDeleteLanguagePack();
        setupStaxModel();
        setupGetCustomLockScreenInfo();
        const error = new UnknownDAError("removeCustomLockScreen failed");
        setupRemoveCustomLockScreen(Left(error));

        const expectedStates: CleanDeviceDAState[] = [
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.WaitForAppAndVersion),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.ListInstalledApps),
          pendingState(CleanDeviceSteps.DeleteLanguagePack),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          pendingState(CleanDeviceSteps.GetCustomLockScreenInfo),
          pendingState(CleanDeviceSteps.RemoveCustomLockScreen),
          pendingState(CleanDeviceSteps.RemoveCustomLockScreen),
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
