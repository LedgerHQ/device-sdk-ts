import { gte } from "semver";

import type { DeviceModelId } from "@api/device/DeviceModel";
import type { InternalApi } from "@api/device-action/DeviceAction";
import { UnknownDAError } from "@api/device-action/os/Errors";
import type {
  ApplicationConstraint,
  ApplicationDependency,
} from "@api/device-action/os/InstallOrUpdateApps/types";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import type { Application } from "@internal/manager-api/model/Application";

export type BuildAppsInstallPlanTaskArgs = {
  /**
   * List of applications to install or update
   */
  readonly applications: ApplicationDependency[];

  /**
   * Indicates if the device action should fail if an application is missing from the app store.
   */
  readonly allowMissingApplication: boolean;
};

export type BuildAppsInstallPlanTaskResult =
  | {
      installPlan: Application[];
      alreadyInstalled: string[];
      missingApplications: string[];
    }
  | {
      error: UnknownDAError;
    };

export class BuildAppsInstallPlanTask {
  private readonly deviceModelId: DeviceModelId;

  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildAppsInstallPlanTaskArgs,
  ) {
    const deviceModel = api.getDeviceModel();
    this.deviceModelId = deviceModel.id;
  }

  run(): BuildAppsInstallPlanTaskResult {
    // Get device session state.
    const deviceState = this.api.getDeviceSessionState();
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { error: new UnknownDAError("Invalid device state") };
    }

    // Ensure the device metadata were correctly fetched.
    if (deviceState.catalog === undefined) {
      return { error: new UnknownDAError("Device apps metadata not fetched") };
    }

    // Build the install plan
    let installPlan: Application[] = [];
    let alreadyInstalled: string[] = [];
    let missingApplications: string[] = [];
    for (const app of this.args.applications) {
      // Get app entry from catalog and from installed apps
      const catalogApp = deviceState.catalog.applications.find(
        (a) => a.versionName === app.name,
      );
      const installedApp = deviceState.installedApps.find(
        (a) => a.versionName === app.name,
      );

      // If app is already installed, with validated constraints, continue the iteration
      if (
        installedApp !== undefined &&
        this.validateConstraint(installedApp, catalogApp, app.constraints)
      ) {
        alreadyInstalled = [...alreadyInstalled, app.name];
        continue;
      }

      // Handle the catalog application
      if (catalogApp !== undefined) {
        // Add the catalog application to the install plan
        installPlan = [...installPlan, catalogApp];
      } else if (this.args.allowMissingApplication) {
        missingApplications = [...missingApplications, app.name];
      } else {
        // Fail immediately if missing application is not allowed
        return {
          error: new UnknownDAError(
            `Application ${app.name} not found in the catalog`,
          ),
        };
      }
    }

    // Find installPlan dependencies
    const dependencies = installPlan.reduce((apps, app) => {
      const dependency = app.parentName;
      if (dependency) {
        const catalogApp = deviceState.catalog!.applications.find(
          (a) => a.versionName === dependency,
        );
        const installedApp = deviceState.installedApps.find(
          (a) => a.versionName === dependency,
        );
        if (catalogApp && !installedApp) {
          return [...apps, catalogApp];
        }
      }
      return apps;
    }, [] as Application[]);

    // Reorder and deduplicate the install plan with its dependencies first
    installPlan = [...dependencies, ...installPlan];
    const reorderedInstallPlan = installPlan.filter(
      (app, index) =>
        installPlan.findIndex((a) => a.versionName === app.versionName) ===
        index,
    );

    return {
      installPlan: reorderedInstallPlan,
      missingApplications,
      alreadyInstalled,
    };
  }

  private validateConstraint(
    app: Application,
    catalogApp?: Application,
    constraints?: ApplicationConstraint[],
  ): boolean {
    if (constraints === undefined) {
      // No constraint
      return true;
    }

    // Validate the constraint
    for (const constraint of constraints) {
      // Is current device exempt from the constraint?
      if (
        constraint.exemptModels !== undefined &&
        constraint.exemptModels.includes(this.deviceModelId)
      ) {
        continue;
      }

      // Is current device not applicable for the constraint?
      if (
        constraint.applicableModels !== undefined &&
        !constraint.applicableModels.includes(this.deviceModelId)
      ) {
        continue;
      }

      // Validate the min version
      if (constraint.minVersion === "latest") {
        return !catalogApp || gte(app.version, catalogApp.version);
      } else {
        return gte(app.version, constraint.minVersion);
      }
    }

    // No constraint for the device
    return true;
  }
}
