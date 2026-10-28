---
applyTo: "**/device-action/**"
---

# Device actions (XState v5)

Device actions (DAs) orchestrate device interactions as XState v5 machines. The base class is `XStateDeviceAction` (`packages/device-management-kit/src/api/device-action/xstate-utils/XStateDeviceAction.ts`). Use the built-in DAs in `packages/device-management-kit/src/api/device-action/os/` as references.

## Conventions

- A DA `extends XStateDeviceAction<Output, Input, Error, IntermediateValue, InternalState>` and implements `makeStateMachine(internalApi)` with `setup({ actors, guards, actions }).createMachine(...)`.
- Async work goes in `fromPromise` actors that call tasks or commands. Their results are `CommandResult` / `Either` values, so check them in guards. Don't use try/catch.
- `extractDependencies(internalApi)` returns the injected task functions, so tests can stub them. Keep side effects out of the machine definition.
- `intermediateValue.requiredUserInteraction` must be set (`UserInteractionRequired.*`) before every step that waits on the user, and reset to `None` afterwards.
- Errors go to `context._internalState.error` and end in the error final state. The DA output is `Either<Error, Output>`. Don't throw.
- When states change, update the state graph doc (`packages/device-management-kit/doc/DeviceActionStateGraph.md`) if it covers that DA.

## Reuse existing DAs: don't reinvent them

Before accepting a new DA, or new states that send device commands, check whether an existing DA already does it. Embed it as a child machine instead: `new XDeviceAction({ input }).makeStateMachine(internalApi)` inside `setup({ actors })`.

Where to look:

- DAs exported by `packages/device-management-kit/src/api/index.ts` (sources: `src/api/device-action/os/` and `src/api/secure-channel/device-action/`).
- `internal/app-binder/device-action/` of the target kit, for kit-specific DAs.

Typical cases: unlock/status checks, going to the dashboard, opening an app, installing apps, reading device metadata.

- "Open the app + run one command or task" needs no dedicated DA: app binders use `SendCommandInAppDeviceAction` / `CallTaskInAppDeviceAction` directly. A dedicated DA is only justified when the flow has its own states: several steps, extra user interactions, or context fetched in between (e.g. `SignTransactionDeviceAction`).
- Child DA states and errors are propagated: forward the child's `intermediateValue` (`requiredUserInteraction`, `step`) and map its error into the parent's error path. Don't drop them.

## Review focus

- **Unhandled paths:**
  - A `fromPromise` actor that can reject needs an `onError`.
  - Child DAs and tasks that return an `Either` / `CommandResult` report failures through `onDone`. Their `Left` must be handled there (see `GoToDashboardDeviceAction`), and no `onError` is needed.
  - Every error branch must reach a final state.
- **Cancellation and unlock-timeout handling:** keep it consistent with the existing DAs.

## Do not flag

- `as any` / `eslint-disable @typescript-eslint/no-explicit-any` around XState typing (`setup` generics, actor snapshots). It is accepted here.
- The `_` arrow parameter in `assign` callbacks (`(_) => ({ ..._.context.intermediateValue })`).
- Long machine definitions in a single file. That is the established style.
