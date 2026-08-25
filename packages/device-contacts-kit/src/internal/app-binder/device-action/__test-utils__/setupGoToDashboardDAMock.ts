import {
  GoToDashboardDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { assign, createMachine } from "xstate";

/**
 * Mock GoToDashboardDeviceAction to resolve immediately with either success
 * (default) or an error. Emits a single `requiredUserInteraction` snapshot
 * (default `None` — device assumed unlocked and already ready) so the parent
 * action can surface it, mirroring the real nested device action.
 */
export const setupGoToDashboardDAMock = (
  options: {
    error?: unknown;
    requiredUserInteraction?: UserInteractionRequired;
  } = {},
) => {
  const interaction =
    options.requiredUserInteraction ?? UserInteractionRequired.None;
  (GoToDashboardDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
        states: {
          pending: {
            entry: assign({
              intermediateValue: {
                requiredUserInteraction: interaction,
              },
            }),
            after: {
              0: "done",
            },
          },
          done: {
            type: "final",
          },
        },
        output: () => (options.error ? Left(options.error) : Right(undefined)),
      }),
    ),
  }));
};
