import {
  type InternalApi,
  UninstallAppDeviceAction,
} from "@ledgerhq/device-management-kit";

type UninstallAppResult = ReturnType<
  UninstallAppDeviceAction["makeStateMachine"]
>;

// `appName` is supplied per invocation through the parent machine's
// `invoke.input`, which drives the child's reactive `context.input.appName`.
// The value passed here only satisfies the constructor's type and is
// otherwise unused, since this single machine definition is re-invoked once
// per app to uninstall.
export const uninstallApp = (
  internalApi: InternalApi,
  unlockTimeout: number,
): UninstallAppResult =>
  new UninstallAppDeviceAction({
    input: { unlockTimeout, appName: "" },
  }).makeStateMachine(internalApi);
