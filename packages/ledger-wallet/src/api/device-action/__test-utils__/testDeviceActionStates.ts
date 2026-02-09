import {
  type DeviceActionState,
  type DmkError,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

/**
 * Interface for device action to avoid circular import issues
 */
interface DeviceAction<Output, _Input, Error, IntermediateValue> {
  _execute(internalApi: InternalApi): {
    observable: {
      subscribe(observer: {
        next: (
          state: DeviceActionState<Output, Error, IntermediateValue>,
        ) => void;
        error: (error: Error) => void;
        complete: () => void;
      }): void;
    };
    cancel: () => void;
  };
}

/**
 * Test that the states emitted by a device action match the expected states.
 * @param deviceAction The device action to test.
 * @param expectedStates The expected states.
 * @param internalApi
 * @param callbacks { onDone, onError } The callbacks to call when the test is done or an error occurs.
 */
export function testDeviceActionStates<
  Output,
  _Input,
  Error extends DmkError,
  IntermediateValue extends { requiredUserInteraction: unknown },
>(
  deviceAction: DeviceAction<Output, _Input, Error, IntermediateValue>,
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

  const { observable, cancel } = deviceAction._execute(internalApi);

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
      } catch (e) {
        onError(e as Error);
      }
    },
  });

  return { observable, cancel };
}
