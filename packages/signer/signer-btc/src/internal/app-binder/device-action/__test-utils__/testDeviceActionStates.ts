import {
  type DeviceAction,
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  type DmkError,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

/**
 * Test that the states emitted by a device action match the expected states.
 * @param deviceAction The device action to test.
 * @param expectedStates The expected states.
 * @param done The Jest done callback.
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
  done?: jest.DoneCallback,
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
      if (done) done(error);
    },
    complete: () => {
      try {
        expect(observedStates).toEqual(expectedStates);
        if (done) done();
      } catch (e) {
        if (done) done(e);
      }
    },
  });
  return { observable, cancel };
}
