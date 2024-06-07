import { setup, fromPromise, assign, log } from "xstate";


export const LOCKED_DEVICE_ERROR = "Locked device";
export const APP_NOT_FOUND_ERROR = "App not installed";
export const OPEN_REJECTED_ERROR = "Open app rejected";
export const DEVICE_NOT_ONBOARDED_ERROR = "Device not onboarded";

async function getAppAndVersionStub(): Promise<{ app: string, version: string }> {
  console.log("getAppAndVersion");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const random = Math.random();
  if (random < 0.25) return {app: "Dashboard", version: "1.0.0"};
  if (random < 0.5) return {app: "Bitcoin", version: "1.0.0"};
  if (random < 0.75) return {app: "Ethereum", version: "1.0.0"};
  throw new Error(LOCKED_DEVICE_ERROR); // 30% chance of locked device
}

async function closeAppStub() {
  console.log("closeApp")
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return;
}

async function openAppStub(appName: string) {
  console.log("openApp")
  if (!appName) throw new Error("No app name provided");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const random = Math.random();
  if (random < 0.33) throw new Error(APP_NOT_FOUND_ERROR);
  if (random < 0.67) throw new Error(OPEN_REJECTED_ERROR);
  return;
}

type DeviceSessionState = {
  status: "Ready" | "Busy" | "Locked" | "NotConnected",
  deviceOnboarded: boolean,
};

type Input = {
  requestedAppName: string,
  deviceSessionState: DeviceSessionState,
}

export type Context = Input & {
  currentlyRunningApp: string | null;
  error: Error | null;
  userActionNeeded: "OpenApp" | null;
}

function makeOpenAppMachine(params: {
  getAppAndVersion: () => Promise<{ app: string, version: string }>,
  closeApp: () => Promise<void>,
  openApp: (appName: string) => Promise<void>,
} = {
  getAppAndVersion: getAppAndVersionStub,
  closeApp: closeAppStub,
  openApp: openAppStub,
}) {
  return setup({
    types: {
      context: {} as Context,
      input: {} as Input,
      output: {} as { currentlyRunningApp: string } | { error: Error },
    },
    actors: {
      getAppAndVersion: fromPromise(params.getAppAndVersion),
      closeApp: fromPromise(params.closeApp),
      openApp: fromPromise((_: {input: {appName: string}}) => params.openApp(_.input.appName)),
    },
    guards: {
      isDeviceOnboarded: ({context}: {context: Context}) => context.deviceSessionState.deviceOnboarded,
      isDeviceUnlocked: ({context}: {context: Context}) => context.deviceSessionState.status !== "Locked",
      isRequestedAppOpen: ({context}: {context: Context}) => {
        if (context.currentlyRunningApp === null) throw new Error("context.currentlyRunningApp === null");
        return context.currentlyRunningApp === context.requestedAppName
      },
      isDashboardOpen: ({context}: {context: Context}) => {
        if (context.currentlyRunningApp === null) throw new Error("context.currentlyRunningApp === null");
        return context.currentlyRunningApp === "Dashboard"
      }
    },
    actions: {
      assignErrorDeviceNotOnboarded: assign({error: new Error(DEVICE_NOT_ONBOARDED_ERROR)}),
      assignErrorDeviceLocked: assign({error: new Error(LOCKED_DEVICE_ERROR)}),
      assignUserActionNeededOpenApp: assign({userActionNeeded: "OpenApp"}),
      assignNoUserActionNeeded: assign({userActionNeeded: null}),
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QHkAOYB2BBVqAiYAbgJYDGYWpALsQPYYB0BJ5ASmAIYQCeAxANoAGALqJQqWrGI16YkAA9EAdgCMDAGyCVAVm3qAzAA4AnNq3bDAGhDdEKgCyGGpw4OMAmffbP37xgL7+1miYOPhEZBTUdIzIGABGtBwAThDEGFAAwgAWYKQA1gIichJSMhhyiggqggzugvbq2qr6Su7aKvr6Kta2CO5tGu7GhvrDKq4jxvaBwejYuMyRlOUMcYkpaRk5eYX8KqJIIKXSMZWI7uruDIYqKu53FtrGbYb2vRd+zg1vDuo67kasxAIQW4RYUVWABlaAV0llcgUiodxJJTrIjlUdAx7IJ9II2vj2ipjHjtB8EPpSTdLqY3B0Bn4lMDQWEluQVjEGDC4dtEXsDiU0eVzv0rjdtK1cQZLrjTBT9OonDUSZozAN7u0WfM2REOdF6AwwgAbMgccpYQgcYjGjjxY1gXgQehgBjpQi0fKu1mLPWQrkms0Wq02u0OhDu2HmmJCYSxoVlM6Y5QMQQPQzqdTGToWLOCck2RBNJQMZ4EwQNfNKSX6bWhX0QzmGwOkaP0S3W232x1gZLJWjJBioW1UABmA4AtmsdQ3lgbGC229gQ13w5HW+VY-GjicRcmxdpU117F5DO4TJLdBTLwx7lnGhX6mMVHWwez-c3cKaNzEdkjt6iiYYqAVT6N8xhGNWbSSpmKjqBShiSremiuPe7SNMyQQgjO4Jzqsi7lH+AooscwpJiBFxKGBSj2CqTSZvYwzwYWCCIWBcGCBmJLdKocGvrqjbzkwHCwNkGypERyIJuiFT7sSDBjDWEznlR7QUjUgjqBoHRKBB0pqgEWE+rh+qrHgIliUkEn8gIgo7mRwEKIgZiHppowTBB1aTOpFZaU0KhUb8NG4oY-GzqZXKZMakgUF+QYxE6LpuhgHpetO9YmR+jBRTFBExBGKVRpuIgAaRQGyRRCCOE4VIPEqtGKh5BZ9HcJgMKoHQVi0GYnmFmVNtl0WwLFw7xfQvC9v2g7Dua47JFOxnvgNDA5cNeX0AVHo-vQW7FPZ5Wiq8pZKpxSoTHiEw+f87U6F0hi6Xo1a1kZOFLUJxnfkuiUYK6kZpYtfrLR9Y0YJtRUxiVe2ATJooDNczzQaoEH3G06nePYClqnodxGAYL4vRlb2rMD20YBNfYDkOI5zQtr2A+9OGfeUYOk7tJG7uRTkIP8GOcYxiEElmJhWCxnT3HUwwNAZShXDMBNvvT+FxaT7BcHwpUc45VSqBo5j2IShiIbpzEtZoJbtEoNE5sYxjqL1wIYLQEBwHIAOCXu0Me1zAC02gY0oeL1BmdtaPm7jqRo6iqNWfjngMzzqH1RNcu+qs8NJXtVIxCFODL9LaO0HgPC8SeK1y6xWVsCK7BnnNVJ4OJvF4ZucW80wUg81znjoNEFxpzSl+7XI8vk8JEbXWuIK0paefougXhMSgKvidS6QFJ4ZpvoXywJeEBsrS4dqG3YTxVPtaQHYynSHNQdCLfSStcbyG5pniW-iz1zITZefqNpPj-tGGckMYeEmOeVoBhdL5gpEoVwNw0z-FaAHCYAVB570NOZUS4kIAAM9nXC44orhZlUICDyZ4KTTDUFRP2VEDBz1MJ-bC38h6GlWiNJmnNNZnyzqMdqrRba228ASdwAwfKDAzCIh4x43Bah3uFLK6UwQcMclw2GFhSw6D0FHUkNstDqWGOxe4FYCSuC6phL+CsWELgPuUNOfQ8GT36IeAuXg76MRPH7TS6ldC1FMFRTilsDCyzQRFQ0ABlAArqQcgsB4CAMzogXEkdpT82Ds8d4osGJ1DutHeo9RtAhIUQAUQpskU+opSQljTOMLM4CtDGHUlkzw-COg4xJNvQIQA */
    id: "OpenAppDeviceAction",
    initial: "DeviceReady",
    context: ({input}): Context => {
      return {
        ...input,
        currentlyRunningApp: null,
        error: null,
        userActionNeeded: null,
      }
    },
    states: {
      DeviceReady: { // check device capabilities & status known
        always: {
          target: "OnboardingCheck",
        }
      },

      OnboardingCheck: { // check onboarding status provided by device session
        always: [{
          target: "LockingCheck",
          guard: {
            type: "isDeviceOnboarded",
          },
        }, {
          target: "Error",
          actions: "assignErrorDeviceNotOnboarded",
        }],
      },

      LockingCheck: {  // check locking status provided by device session
        always: [{
          target: "ApplicationAvailable",
          guard: "isDeviceUnlocked",
        }, {
          target: "Error",
          actions: "assignErrorDeviceLocked",
        }]
      },

      ApplicationAvailable: {  // execute getAppAndVersion command
        invoke: {
          src: "getAppAndVersion",
          onDone: {
            target: "ApplicationCheck",
            actions: assign({
              currentlyRunningApp: (_) => _.event.output.app,
            }),
          },
          onError: {
            target: "Error",
            actions: 
              assign({
                error: ({event}) => {
                  return event.error as Error
                },
              }),
          },
        }
      },

      ApplicationCheck: {  // Is the current application the requested one
        always: [{
          target: "ApplicationReady",
          guard: "isRequestedAppOpen",
        }, "DashboardCheck"]
      },

      DashboardCheck: {  // Is the current application the dashboard
        always: [{
          target: "OpenApplication",
          guard: "isDashboardOpen",
        }, "CloseApplication"]
      },

      CloseApplication: {
        invoke: {
          src: "closeApp",
          onDone: {
            target: "OpenApplication",
            reenter: true
          },
          onError: {
            target: "Error",
            actions: 
              assign({
                error: ({event}) => event.error as Error,
              }),
          },
        }
      },

      OpenApplication: {  // execute openApp command,
        entry: "assignUserActionNeededOpenApp",
        exit: "assignNoUserActionNeeded",
        invoke: {
          src: "openApp",
          input: ({context}) => ({appName: context.requestedAppName}),
          onDone: {
            target: "ApplicationReady",
            actions: assign({
              currentlyRunningApp: (_) => _.context.requestedAppName,
            }),
          },
          onError: {
            target: "Error",
            actions: 
              assign({
                error: ({event}) => event.error as Error,
              }),
          },
        }
      },

      ApplicationReady: {  // application is ready to be used
        always: "Success"
      },

      // success state
      Success: {
        type: "final",
      },

      // error state
      Error: {
        type: "final",
      },
    },
    output: ({context}) => context.error ? ({error: context.error}) : ({
      currentlyRunningApp: context.currentlyRunningApp as string,
    }),
  });
}



export default makeOpenAppMachine;