import { type Either, Left } from "purify-ts";
import {
  type ActionFunction,
  enqueueActions,
  type EventObject,
  type MachineContext,
  type ParameterizedObject,
  type ProvidedActor,
} from "xstate";

type UnwrapEither<T extends Either<unknown, unknown>> =
  T extends Either<infer L, infer R> ? { L: L; R: R } : never;

export function continueAction<
  TContext extends MachineContext & {
    _internalState: Either<unknown, object>;
  },
  TExpressionEvent extends EventObject,
  TParams extends Either<
    UnwrapEither<TContext["_internalState"]>["L"],
    {
      // type: TEvent["type"];
      type: string;
      state?: Partial<UnwrapEither<TContext["_internalState"]>["R"]>;
    }
  >,
  TEvent extends EventObject = TExpressionEvent,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = never,
  TEmitted extends EventObject = EventObject,
>(): ActionFunction<
  TContext,
  TExpressionEvent,
  TEvent,
  TParams,
  TActor,
  TAction,
  TGuard,
  TDelay,
  TEmitted
> {
  return enqueueActions(({ context, enqueue }, params) => {
    params.caseOf({
      Left: (error) => {
        enqueue.raise({ type: "error" } as TEvent);
        enqueue.assign({ _internalState: Left(error) } as Partial<TContext>);
      },

      Right: ({ type, state }) => {
        // Double check internal state
        if (context._internalState.isLeft()) {
          return enqueue.raise({ type: "error" } as TEvent);
        }

        if (state) {
          enqueue.assign({
            _internalState: context._internalState.map((_internalState) => ({
              ..._internalState,
              state,
            })) as TContext["_internalState"],
          } as Partial<TContext>);
        }
        enqueue.raise({ type } as TEvent);
      },
    });
  });
}
