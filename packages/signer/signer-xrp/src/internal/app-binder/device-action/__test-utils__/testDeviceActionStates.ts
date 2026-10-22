import {
  type DeviceAction,
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  type DmkError,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

/**
 * Test that the states emitted by a device action match the expected states.
 */
export function testDeviceActionStates<
  Output,
  Input,
  Error extends DmkError,
  IntermediateValue extends DeviceActionIntermediateValue,
>(
  deviceAction: DeviceAction<Output, Input, Error, IntermediateValue>,
  expectedStates: Array<DeviceActionState<Output, Error, IntermediateValue>>,
  internalApi: InternalApi,
  {
    onDone,
    onError,
  }: {
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  const observedStates: Array<
    DeviceActionState<Output, Error, IntermediateValue>
  > = [];

  const { observable } = deviceAction._execute(internalApi);
  observable.subscribe({
    next: (state) => {
      observedStates.push(state);
    },
    error: (error) => {
      onError(error);
    },
    complete: () => {
      try {
        expect(observedStates).toEqual(expectedStates);
        onDone();
      } catch (error) {
        onError(error as Error);
      }
    },
  });
}
