import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { UnknownDAError } from "@api/device-action/os/Errors";
import type { TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import type { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import type { Application } from "@internal/manager-api/model/Application";

import { BuildAppsInstallPlanTask } from "./BuildAppsInstallPlanTask";

describe("BuildAppsInstallPlanTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getDeviceModel.mockReturnValue({
      id: DeviceModelId.NANO_X,
    } as unknown as TransportDeviceModel);
  });

  it("Success with no changes needed", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [
        { versionName: "Ethereum", version: "1.5.0" },
        { versionName: "Bitcoin", version: "1.3.0" },
      ] as unknown as Application[],
      catalog: {
        applications: [] as unknown as Application[],
        languagePackages: [],
      },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [{ name: "Ethereum" }, { name: "Bitcoin" }],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      installPlan: [],
      alreadyInstalled: ["Ethereum", "Bitcoin"],
      missingApplications: [],
    });
  });

  it("Success with no constraints", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [
        { versionName: "Ethereum", version: "1.5.0" },
        { versionName: "Bitcoin", version: "1.3.0" },
      ] as unknown as Application[],
      catalog: {
        applications: [
          { versionName: "Ethereum", version: "1.6.0" },
          { versionName: "Bitcoin", version: "1.3.0" },
          { versionName: "Solana", version: "1.2.0" },
          { versionName: "MyShitCoin", version: "0.0.1" },
          { versionName: "Cardano", version: "1.1.0" },
        ] as unknown as Application[],
        languagePackages: [],
      },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [
        { name: "Ethereum" },
        { name: "Solana" },
        { name: "Cardano" },
      ],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      installPlan: [
        { versionName: "Solana", version: "1.2.0" },
        { versionName: "Cardano", version: "1.1.0" },
      ],
      alreadyInstalled: ["Ethereum"],
      missingApplications: [],
    });
  });

  it("Success with applicable constraints", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [
        { versionName: "Ethereum", version: "1.5.0" },
        { versionName: "Bitcoin", version: "1.2.0" },
        { versionName: "Solana", version: "1.1.0" },
        { versionName: "Cardano", version: "1.1.0" },
      ] as unknown as Application[],
      catalog: {
        applications: [
          { versionName: "Ethereum", version: "1.6.0" },
          { versionName: "Bitcoin", version: "1.3.0" },
          { versionName: "Solana", version: "1.2.0" },
          { versionName: "MyShitCoin", version: "0.0.1" },
          { versionName: "Cardano", version: "1.2.0" },
        ] as unknown as Application[],
        languagePackages: [],
      },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [
        {
          name: "Ethereum",
          constraints: [
            { minVersion: "1.6.0", applicableModels: [DeviceModelId.NANO_X] },
          ],
        },
        {
          name: "Bitcoin",
          constraints: [
            { minVersion: "1.2.1", exemptModels: [DeviceModelId.NANO_S] },
          ],
        },
        { name: "Solana", constraints: [{ minVersion: "1.2.0" }] },
      ],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      installPlan: [
        { versionName: "Ethereum", version: "1.6.0" },
        { versionName: "Bitcoin", version: "1.3.0" },
        { versionName: "Solana", version: "1.2.0" },
      ],
      alreadyInstalled: [],
      missingApplications: [],
    });
  });

  it("Success with non-applicable constraints", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [
        { versionName: "Ethereum", version: "1.5.0" },
        { versionName: "Bitcoin", version: "1.2.0" },
        { versionName: "Solana", version: "1.1.0" },
        { versionName: "Cardano", version: "1.1.0" },
      ] as unknown as Application[],
      catalog: {
        applications: [
          { versionName: "Ethereum", version: "1.6.0" },
          { versionName: "Bitcoin", version: "1.3.0" },
          { versionName: "Solana", version: "1.2.0" },
          { versionName: "MyShitCoin", version: "0.0.1" },
          { versionName: "Cardano", version: "1.2.0" },
        ] as unknown as Application[],
        languagePackages: [],
      },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [
        {
          name: "Ethereum",
          constraints: [
            { minVersion: "1.6.0", exemptModels: [DeviceModelId.NANO_X] },
          ],
        },
        {
          name: "Bitcoin",
          constraints: [
            { minVersion: "1.2.1", applicableModels: [DeviceModelId.NANO_S] },
          ],
        },
        { name: "Cardano", constraints: [{ minVersion: "1.1.0" }] },
      ],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      installPlan: [],
      alreadyInstalled: ["Ethereum", "Bitcoin", "Cardano"],
      missingApplications: [],
    });
  });

  it("Success with applicable constraints latest version", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [
        { versionName: "Ethereum", version: "1.5.0" },
        { versionName: "Bitcoin", version: "1.3.0" },
        { versionName: "Solana", version: "1.1.0" },
        { versionName: "MyShitCoin", version: "0.0.1" },
      ] as unknown as Application[],
      catalog: {
        applications: [
          { versionName: "Ethereum", version: "1.6.0" },
          { versionName: "Bitcoin", version: "1.3.0" },
          { versionName: "Solana", version: "1.2.0" },
          { versionName: "Cardano", version: "1.2.0" },
        ] as unknown as Application[],
        languagePackages: [],
      },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [
        { name: "Ethereum", constraints: [{ minVersion: "latest" }] },
        { name: "Bitcoin", constraints: [{ minVersion: "latest" }] },
        { name: "MyShitCoin", constraints: [{ minVersion: "latest" }] },
      ],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      installPlan: [{ versionName: "Ethereum", version: "1.6.0" }],
      alreadyInstalled: ["Bitcoin", "MyShitCoin"],
      missingApplications: [],
    });
  });

  it("Success with dependencies", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [
        { versionName: "AlreadyInstalledDep", version: "1.2.0" },
      ] as unknown as Application[],
      catalog: {
        applications: [
          { versionName: "Ethereum", version: "1.6.0", parentName: undefined },
          { versionName: "Solana", version: "1.2.0", parentName: undefined },
          {
            versionName: "MyEthShitCoin",
            version: "0.0.1",
            parentName: "Ethereum",
          },
          {
            versionName: "MySolShitCoin",
            version: "0.0.1",
            parentName: "Solana",
          },
          {
            versionName: "MyPumpFunShitCoin",
            version: "0.0.1",
            parentName: "Solana",
          },
          { versionName: "Cardano", version: "1.2.0", parentName: undefined },
          {
            versionName: "AlreadyInstalledDep",
            version: "1.2.0",
            parentName: "Cardano",
          },
        ] as unknown as Application[],
        languagePackages: [],
      },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [
        { name: "MyEthShitCoin" },
        { name: "MySolShitCoin" },
        { name: "Solana" },
        { name: "MyPumpFunShitCoin" },
        { name: "AlreadyInstalledDep" },
      ],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      installPlan: [
        { versionName: "Ethereum", version: "1.6.0", parentName: undefined },
        { versionName: "Solana", version: "1.2.0", parentName: undefined },
        {
          versionName: "MyEthShitCoin",
          version: "0.0.1",
          parentName: "Ethereum",
        },
        {
          versionName: "MySolShitCoin",
          version: "0.0.1",
          parentName: "Solana",
        },
        {
          versionName: "MyPumpFunShitCoin",
          version: "0.0.1",
          parentName: "Solana",
        },
      ],
      alreadyInstalled: ["AlreadyInstalledDep"],
      missingApplications: [],
    });
  });

  it("Success with allowed missing applications", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [
        { versionName: "Ethereum", version: "1.5.0" },
        { versionName: "Bitcoin", version: "1.3.0" },
      ] as unknown as Application[],
      catalog: {
        applications: [
          { versionName: "Ethereum", version: "1.6.0" },
          { versionName: "Bitcoin", version: "1.3.0" },
          { versionName: "Solana", version: "1.2.0" },
        ] as unknown as Application[],
        languagePackages: [],
      },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [
        { name: "Ethereum" },
        { name: "Solana" },
        { name: "Cardano" },
      ],
      allowMissingApplication: true,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      installPlan: [{ versionName: "Solana", version: "1.2.0" }],
      alreadyInstalled: ["Ethereum"],
      missingApplications: ["Cardano"],
    });
  });

  it("Error when device is in incorrect state", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
    } as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [{ name: "Ethereum" }],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      error: new UnknownDAError("Invalid device state"),
    });
  });

  it("Error when device session was not populated", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [{ name: "Ethereum" }],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      error: new UnknownDAError("Device apps metadata not fetched"),
    });
  });

  it("Error when an app is not found in the catalog", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [] as unknown as Application[],
      catalog: {
        applications: [] as unknown as Application[],
        languagePackages: [],
      },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new BuildAppsInstallPlanTask(apiMock, {
      applications: [
        { name: "Ethereum" },
        { name: "Bitcoin" },
        { name: "Solana" },
      ],
      allowMissingApplication: false,
    }).run();

    // THEN
    expect(result).toStrictEqual({
      error: new UnknownDAError(
        "Application Ethereum not found in the catalog",
      ),
    });
  });
});
