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
  | { status: DeviceActionStatus.NotStarted }
  | { status: DeviceActionStatus.Pending; intermediateValue: IntermediateValue }
  | { status: DeviceActionStatus.Stopped }
  | { status: DeviceActionStatus.Completed; output: Output }
  | { status: DeviceActionStatus.Error; error: Error };
