# Device Actions

List of device actions state flows.

# OS Level Device Actions

## Get Device Status

Check for device availability and returns CurrentApp

### Inputs

- unlockTimeout \[number\] _(optional)_

### Outputs

- Opened application (or BOLOS for Dashboard)

```mermaid
stateDiagram-v2
state GetDeviceStatusDeviceAction {
  [*] --> DeviceReady
  DeviceReady --> OnboardingCheck
  OnboardingCheck --> isDeviceUnlocked: Onboarded
  OnboardingCheck --> Error: Not onboarded
  isDeviceUnlocked --> GetAppAndVersionCommand: Unlocked
  isDeviceUnlocked --> UserActionUnlockDevice: Locked
  UserActionUnlockDevice --> Error: User denied device unlock
  UserActionUnlockDevice --> GetAppAndVersionCommand: User unlocked device
  GetAppAndVersionCommand --> SaveAppState: Got app and version
  GetAppAndVersionCommand --> Error: Command error
  SaveAppState --> Complete: Successfully saved in session
  SaveAppState --> Error: Error Saving in session
  Complete --> [*]
  Error --> [*]

  state Complete {
    [*] --> Success
  }

  state Error {
    [*] --> Stop
  }
}
```

## GoToDashboardDeviceAction

Sanity check or action to return to the Dashboard for OS level commands / actions

### Inputs

- unlockTimeout \[number\] _(optional)_

### Outputs

none

```mermaid
stateDiagram-v2
state GoToDashboardDeviceAction  {
  [*] --> GetCurrentAppDeviceAction
  GetCurrentAppDeviceAction --> CloseAppCommand: Not on dashboard
  GetCurrentAppDeviceAction --> Complete: On dashboard
  CloseAppCommand --> Error: Command error
  CloseAppCommand --> GetAppAndVersionCommand: App closed
  GetAppAndVersionCommand --> SaveAppState: On dashboard
  GetAppAndVersionCommand --> Error: Command error
  GetCurrentAppDeviceAction --> Error: Device action error
  SaveAppState --> Complete: Success saving app in session
  SaveAppState --> Error: Error saving app in session
  Complete --> [*]
  Error --> [*]

  state Complete {
    [*] --> Success
  }

  state Error {
    [*] --> Stop
  }
}
```

## ListAppsDeviceAction

Returns a list of installed applications on the device

### Inputs

- unlockTimeout \[number\] _(optional)_

### Outputs

- Applications

```mermaid
stateDiagram-v2
state ListAppsDeviceAction {
  [*] --> GoToDashboardDeviceAction
  GoToDashboardDeviceAction --> ListAllApps: Success
  GoToDashboardDeviceAction --> Error: Failure
  Error --> [*]
  Success --> [*]

  state ListAllApps {
    [*] --> UserActionApproval
    UserActionApproval --> ListAppsCommand: user approved
    UserActionApproval --> ListAppsCommand: super approval already granted (genuine check)
    UserActionApproval --> Error: user denied
    UserActionApproval --> Error: unexpected error
    ListAppsCommand --> Success: no application installed
    ListAppsCommand --> Success: only one application
    ListAppsCommand --> ListAppsContinueCommand: two applications
    ListAppsCommand --> Error: ListAppsCommand error
    ListAppsContinueCommand --> Success: no application
    ListAppsContinueCommand --> Success: only one application
    ListAppsContinueCommand --> ListAppsContinueCommand: two applications
    ListAppsContinueCommand --> Error: ListAppsContinueCommand error
  }

  state Error {
    [*] --> Stop
  }

  state Success {
    [*] --> Done
  }
}
```

## ListAppsWithMetadata

Returns a list of installed application on the device and their metadata

### Inputs

- unlockTimeout \[number\] _(optional)_

### Outputs

- Applications installed and their metadata

```mermaid
stateDiagram-v2
state ListAppsWithMetadata {
  [*] --> ListApps
  ListApps --> FetchAppsMetaData: Got a list of apps
  ListApps --> Success: Not apps installed on the device
  ListApps --> Error: Error getting ListApps response

  state FetchAppsMetaData {
    [*] --> FetchMetadata
    FetchMetadata --> SetInstalledApps: Got apps metadata
    FetchMetadata --> Error: Error fetching apps metadata
    SetInstalledApps --> Success: Set apps metadata in device session
    SetInstalledApps --> Error: Error setting apps metadata
  }

  state Error {
    [*] --> Stop
  }

  state Success {
    [*] --> Done
  }
}
```

## OpenAppDeviceAction

Checks for an installed app on the device an opens it

### Inputs

- AppName
- Device session

### Outputs

- Opened application

```mermaid
stateDiagram-v2
state OpenAppDeviceAction {
  [*] --> GetCurrentApp
  GetCurrentApp --> OpenApp: Requested app not opened
  GetCurrentApp --> Success: Requested app already opened
  GetCurrentApp --> Error: Device action error
  Error --> [*]
  Success --> [*]

  state OpenApp {
    [*] --> DashboardCheck
    DashboardCheck --> CloseAppCommand: App is not dashboard
    DashboardCheck --> OpenAppCommand: App is dashboard
    DashboardCheck --> Error: Dashboard check error
    CloseAppCommand --> OpenAppCommand: Closed the current app
    OpenAppCommand --> SaveAppState: App is opened
    OpenAppCommand --> Error: Command error
    OpenAppCommand --> Error: Application not installed
    SaveAppState --> Success: Saved application state
    SaveAppState --> Error: Saved state error
  }


  state Error {
    [*] --> Stop
  }

  state Success {
    [*] --> Done
  }
}
```
