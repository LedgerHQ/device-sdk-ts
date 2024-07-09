import { Either } from "purify-ts";

/**
 * The internal types of an XState state machine.
 * This is to easily map between the snapshots of any state machine with these
 * types and a DeviceActionState.
 */
export type StateMachineTypes<
  Output,
  Input,
  Error,
  IntermediateValue,
  InternalState,
> = {
  output: Either<Error, Output>;
  input: Input;
  context: {
    input: Input;
    intermediateValue: IntermediateValue;
    _internalState: InternalState;
  };
};
