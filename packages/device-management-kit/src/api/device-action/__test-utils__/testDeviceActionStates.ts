import {
  type DeviceAction,
  type DeviceActionIntermediateValue,
  type InternalApi,
} from "@api/device-action/DeviceAction";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type DmkError } from "@api/Error";

/**
 * Test that the states emitted by a device action match the expected states.
 * @param deviceAction The device action to test.
 * @param expectedStates The expected states.
 * @param internalApi
 * @param done A promise resolve callback.
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
  done: (value?: unknown) => void,
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
      done(error);
    },
    complete: () => {
      try {
        expect(observedStates).toEqual(expectedStates);
        done();
      } catch (e) {
        done(e);
      }
    },
  });
  return { observable, cancel };
}
