import { type Either, Left } from "purify-ts";
import {
  type ActionArgs,
  type ActionFunction,
  enqueueActions,
  type EventObject,
  type MachineContext,
  type ParameterizedObject,
  type ProvidedActor,
} from "xstate";

type UnwrapEither<T extends Either<unknown, unknown>> =
  T extends Either<infer L, infer R> ? { L: L; R: R } : never;

/**
 * Both raises an event and assigns values to the _internalState based on an Either result.
 * When the result is Left: automatically raises "error" and set the _internalState to the result.
 *
 * Example usage:
 *
 * Foo: {
 *   on: { bar: Bar , baz: Baz, retry: Retry, error: Error },
 *   invoke: {
 *     src: "someActor",
 *     onDone: raiseAndAssign(({ event }) =>
 *       event.output
 *         .map(({ resultType, payload }) => {
 *           switch(resultType) {
 *             case "A":
 *               return { raise: "bar", assign: { A: payload.A } };
 *             case "B":
 *               return { raise: "baz", assign: { B: payload.B } };
 *           }
 *         })
 *         .chainLeft((error) =>
 *           error instanceof SomeError
 *             ? Right({ raise: "retry", assign: { count: error.count } })
 *             : Left(error)
 *         ),
 *     ),
 */

export function raiseAndAssign<
  TContext extends MachineContext & {
    _internalState: Either<unknown, object>;
  },
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject["params"] | undefined,
  TEvent extends EventObject = TExpressionEvent,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = never,
  TEmitted extends EventObject = EventObject,
>(
  args: (args: ActionArgs<TContext, TExpressionEvent, TEvent>) => Either<
    UnwrapEither<TContext["_internalState"]>["L"],
    {
      raise: TEvent["type"];
      assign?: Partial<UnwrapEither<TContext["_internalState"]>["R"]>;
    }
  >,
): ActionFunction<
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
  return enqueueActions(({ enqueue, ...actionArgs }) => {
    args(actionArgs)
      .ifLeft((error) => {
        enqueue.assign({ _internalState: Left(error) } as Partial<TContext>);
        enqueue.raise({ type: "error" } as TEvent);
      })

      .ifRight(({ raise, assign }) => {
        // Double check internal state
        if (actionArgs.context._internalState.isLeft()) {
          return enqueue.raise({ type: "error" } as TEvent);
        }

        if (assign) {
          enqueue.assign({
            _internalState: actionArgs.context._internalState.map<
              Partial<UnwrapEither<TContext["_internalState"]>["R"]>
            >((prev) => ({ ...prev, ...assign })),
          } as Partial<TContext>);
        }
        enqueue.raise({ type: raise } as TEvent);
      });
  });
}
