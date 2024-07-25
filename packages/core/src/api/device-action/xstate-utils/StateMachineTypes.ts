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
  readonly output: Either<Error, Output>;
  readonly input: Input;
  readonly context: {
    readonly input: Input;
    readonly intermediateValue: IntermediateValue;
    readonly _internalState: InternalState;
  };
};
