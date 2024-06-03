import { setup, fromPromise, assign, log } from "xstate";


type DeviceSessionState = {
  status: "Ready" | "Busy" | "Locked" | "NotConnected",
  deviceOnboarded: boolean,
};

type Input = {
  requestedAppName: string,
  deviceSessionState: DeviceSessionState,
}

type Context = Input & {
  currentlyRunningApp: string | null;
  error: Error | null;
}

export const LOCKED_DEVICE_ERROR = "Locked device";
export const APP_NOT_FOUND_ERROR = "App not installed";
export const OPEN_REJECTED_ERROR = "Open app rejected";
export const DEVICE_NOT_ONBOARDED_ERROR = "Device not onboarded";

async function mockedGetAppAndVersion(): Promise<{ app: string, version: string }> {
  console.log("getAppAndVersion");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const random = Math.random();
  if (random < 0.25) return {app: "Dashboard", version: "1.0.0"};
  if (random < 0.5) return {app: "Bitcoin", version: "1.0.0"};
  if (random < 0.75) return {app: "Ethereum", version: "1.0.0"};
  throw new Error(LOCKED_DEVICE_ERROR); // 30% chance of locked device
}

async function mockedCloseApp() {
  console.log("closeApp")
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return;
}

async function mockedOpenApp(appName: string) {
  console.log("openApp")
  if (!appName) throw new Error("No app name provided");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const random = Math.random();
  if (random < 0.33) throw new Error(APP_NOT_FOUND_ERROR);
  if (random < 0.67) throw new Error(OPEN_REJECTED_ERROR);
  return;
}

function makeOpenAppMachine(params: {
  getAppAndVersion: () => Promise<{ app: string, version: string }>,
  closeApp: () => Promise<void>,
  openApp: (appName: string) => Promise<void>,
} = {
  getAppAndVersion: mockedGetAppAndVersion,
  closeApp: mockedCloseApp,
  openApp: mockedOpenApp,
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
      assignErrorDeviceLocked: assign({error: new Error(LOCKED_DEVICE_ERROR)})
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QHkAOYB2BBVqAiYAbgJYDGYWpALsQPYYB0BJ5ASmAIYQCeAxANoAGALqJQqWrGI16YkAA9EAdgCMDAGyCVAVm3qAzAA4AnNq3bDAGhDdEKgCyGGpw4OMAmffbP37xgL7+1miYOPhEZBTUdIzIGABGtBwAThDEGFAAwgAWYKQA1gIichJSMhhyiggqggzugvbq2qr6Su7aKvr6Kta2CO5tGu7GhvrDKq4jxvaBwejYuMyRlOUMcYkpaRk5eYX8KqJIIKXSMZWI7uruDIYqKu53FtrGbYb2vRd+zg1vDuo67kasxAIQW4RYUVWABlaAV0llcgUiodxJJTrIjlUdAx7IJ9II2vj2ipjHjtB8EPpSTdLqY3B0Bn4lMDQWEluQVjEGDC4dtEXsDiU0eVzv0rjdtK1cQZLrjTBT9OonDUSZozAN7u0WfM2REOdF6AwwgAbMgccpYQgcYjGjjxY1gXgQehgBjpQi0fKu1mLPWQrkms0Wq02u0OhDu2HmmJCYSxoVlM6Y5QMQQPQzqdTGToWLOCck2RBNJQMZ4EwQNfNKSX6bWhX0QzmGwOkaP0S3W232x1gZLJWjJBioW1UABmA4AtmsdQ3lgbGC229gQ13w5HW+VY-GjicRcmxdpU117F5DO4TJLdBTLwx7lnGhX6mMVHWwez-c3cKaNzEdkjt6iiYYqAVT6N8xhGNWbSSpmKjqBShiSremiuPe7SNMyQQgjO4Jzqsi7lH+AooscwpJiBFxKGBSj2CqTSZvYwzwYWCCIWBcGCBmJLdKocGvrqjbzkwHCwNkGypERyIJuiFT7sSDBjDWEznlR7QUjUgjqBoHRKBB0pqgEWE+rh+qrHgIliUkEn8gIgo7mRwEKIgZiHppowTBB1aTOpFZaU0KhUb8NG4oY-GzqZXKZMakgUF+QYxE6LpuhgHpetO9YmR+jBRTFBExBGKVRpuIgAaRQGyRRCCOE4VIPEqtGKh5BZ9HcJgMKoHQVi0GYnmFmVNtl0WwLFw7xfQvC9v2g7Dua47JFOxnvgNDA5cNeX0AVHo-vQW7FPZ5Wiq8pZKpxSoTHiEw+f87U6F0hi6Xo1a1kZOFLUJxnfkuiUYK6kZpYtfrLR9Y0YJtRUxiVe2ATJooDNcgKaYxiqIfdSjqbi1z3HcF09SeMwvRlb2rMD20YBNfYDkOI5zQtr2A+9OGfeUYOk7tJG7uRTlVWeN2mKSJ5w2e6ndGBvi6BBhiuH46h9UTAZxaT7BcHwpUc45VSqBo5j2ISkvNMYzEtZoJbtEoNE5sYBu9cCGC0BAcByADgl7tDLtcwAtNo9jtXi9QZuouI1No7jqRo6iqAbRioRpnGy-TZl+krPDSW7VSMQhThKJopjB887gPC8cfO1y6xWVsCK7CnnNVJ4OJvF4xucW80wUg88O3M03gPBWzRF3hXI8vk8JEVX6uIK0paefougXhMaMsV0tQDNmNFGEqSqhQTb7x-Lo2kx2obdqPFUe1pSi+6dAdaPml0sZK1xvJLmmeGb+LPXMhM75+e9LiP+0w3Jb2HhJjnlaAYXS+YKRKFcDcNM-xWjnwmAFPuEVDTmVEuJCAf9XbVwuOKK4WZVCAg8kLFi0w1BUS9lRAw09TDv2wp-YuhpVojSZpzNWJ806jHaq0A2VszBtAGD5QYGZ84PGPG4LUW8BL90NCTJcx9YYWFLDoPQ4dSSWy0OpYY7F7gVgJK4LqmEP7byYQuBWS4k59BwWPfoh5g5eA6G8QE09pTqV0LUUwVFOJmwMFcfGJiZGoMYAAZQAK6kHILAeA-9U6IFxGHaUjFJaZmeO8FicEA51DuqoNoaZ8woKygwAAohTZIij9ykhLGmcYWZQFaGMOpBi2TeEdDuN0EYgRAhAA */
    id: "OpenAppDeviceAction",
    initial: "DeviceReady",
    context: ({input}): Context => {
      return {
        ...input,
        currentlyRunningApp: null,
        error: null,
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