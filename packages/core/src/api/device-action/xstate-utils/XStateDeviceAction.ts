import { createBrowserInspector } from "@statelyai/inspect";
import { Observable, ReplaySubject, share } from "rxjs";
import { createActor, SnapshotFrom, StateMachine } from "xstate";

import {
  DeviceAction,
  DeviceActionIntermediateValue,
  ExecuteDeviceActionReturnType,
  InternalApi,
} from "@api/device-action/DeviceAction";
import {
  DeviceActionState,
  DeviceActionStatus,
} from "@api/device-action/model/DeviceActionState";
import { SdkError } from "@api/Error";

import { StateMachineTypes } from "./StateMachineTypes";

type DeviceActionStateMachine<
  Output,
  Input,
  Error extends SdkError,
  IntermediateValue extends DeviceActionIntermediateValue,
  InternalState,
> = StateMachine<
  StateMachineTypes<
    Output,
    Input,
    Error,
    IntermediateValue,
    InternalState
  >["context"], // context
  /**
   * The following usages `any` are OK because this is just a wrapper around the
   * state machine and we are not directly going to use these types.
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  any, // event
  any, // children
  any, // actor
  any, // action
  any, // guard
  any, // delay
  any, // state value
  any, // tag
  /* eslint-enable @typescript-eslint/no-explicit-any */
  StateMachineTypes<
    Output,
    Input,
    Error,
    IntermediateValue,
    InternalState
  >["input"],
  StateMachineTypes<
    Output,
    Input,
    Error,
    IntermediateValue,
    InternalState
  >["output"],
  /* eslint-disable @typescript-eslint/no-explicit-any */
  any,
  any
  /* eslint-enable @typescript-eslint/no-explicit-any */
>;

/**
 * A DeviceAction that uses an XState state machine to execute.
 * It maps the state machine snapshots to the DeviceActionState.
 * This class is abstract and should be extended to implement the state machine.
 */
export abstract class XStateDeviceAction<
  Output,
  Input,
  Error extends SdkError,
  IntermediateValue extends DeviceActionIntermediateValue,
  InternalState,
> implements DeviceAction<Output, Input, Error, IntermediateValue>
{
  readonly input: Input;
  readonly inspect: boolean = false;

  /**
   *
   * @param input The input for the DeviceAction
   * @param inspect If true, the state machine will be inspected in the browser
   */
  constructor(args: { input: Input; inspect?: boolean }) {
    this.input = args.input;
    this.inspect = Boolean(args.inspect);
  }

  protected abstract makeStateMachine(
    internalAPI: InternalApi,
  ): DeviceActionStateMachine<
    Output,
    Input,
    Error,
    IntermediateValue,
    InternalState
  >;

  _execute(
    internalApi: InternalApi,
  ): ExecuteDeviceActionReturnType<Output, Error, IntermediateValue> {
    const stateMachine = this.makeStateMachine(internalApi);

    const actor = createActor(stateMachine, {
      input: this.input,
      // optional inspector for debugging
      inspect: this.inspect ? createBrowserInspector().inspect : undefined,
    });

    /**
     * Using a ReplaySubject is important because the first snapshots might be
     * emitted before the observable is subscribed (if the machine goes through
     * those states fully synchronously).
     * This way, we ensure that the subscriber always receives the latest snapshot.
     * */
    const subject = new ReplaySubject<
      DeviceActionState<Output, Error, IntermediateValue>
    >();

    const handleActorSnapshot = (
      snapshot: SnapshotFrom<typeof stateMachine>,
    ) => {
      const { context, status, output, error } = snapshot;
      switch (status) {
        case "active":
          subject.next({
            status: DeviceActionStatus.Pending,
            intermediateValue: context.intermediateValue,
          });
          break;
        case "done":
          output.caseOf({
            Left: (err) => {
              subject.next({
                status: DeviceActionStatus.Error,
                error: err,
              });
            },
            Right: (result) => {
              subject.next({
                status: DeviceActionStatus.Completed,
                output: result,
              });
            },
          });
          subject.complete();
          break;
        case "error":
          // this is an error in the execution of the state machine, it should not happen
          subject.error(error);
          subject.complete();
          break;
        case "stopped":
          subject.next({
            status: DeviceActionStatus.Stopped,
          });
          subject.complete();
          break;
        default:
          this._exhaustiveMatchingGuard(status);
      }
    };

    const observable = new Observable<
      DeviceActionState<Output, Error, IntermediateValue>
    >((subscriber) => {
      const subjectSubscription = subject.subscribe(subscriber);
      return () => {
        actorSubscription.unsubscribe();
        subjectSubscription.unsubscribe();
        actor.stop(); // stop the actor when the observable is unsubscribed
      };
    });

    const actorSubscription = actor.subscribe(handleActorSnapshot);
    actor.start();

    return {
      observable: observable.pipe(share()), // share to garantee that once there is no more observer, the actor is stopped
      cancel: () => {
        actor.stop();
        actorSubscription.unsubscribe();
        handleActorSnapshot(actor.getSnapshot());
      },
    };
  }

  private _exhaustiveMatchingGuard(status: never): never {
    console.log("_exhaustiveMatchingGuard status", status);
    throw new Error(`Unhandled status: ${status}`);
  }
}
