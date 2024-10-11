/**
 * The status of a device action.
 */
export enum DeviceActionStatus {
  NotStarted = "not-started",
  Pending = "pending",
  Stopped = "stopped",
  Completed = "completed",
  Error = "error",
}

export type DeviceActionState<Output, Error, IntermediateValue> =
  | { readonly status: DeviceActionStatus.NotStarted }
  | {
      readonly status: DeviceActionStatus.Pending;
      readonly intermediateValue: IntermediateValue;
    }
  | { readonly status: DeviceActionStatus.Stopped }
  | { readonly status: DeviceActionStatus.Completed; readonly output: Output }
  | { readonly status: DeviceActionStatus.Error; readonly error: Error };
