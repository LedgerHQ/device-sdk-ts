import {
  GoToDashboardDeviceAction,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { type Mock, vi } from "vitest";
import { assign, createMachine } from "xstate";

/**
 * Sets up a mock for GoToDashboardDeviceAction.
 * Must be called after vi.mock("@ledgerhq/device-management-kit", ...) is set up.
 *
 * @param error - If true, the mock will return an error
 */
export const setupGoToDashboardMock = (error = false) => {
  (GoToDashboardDeviceAction as unknown as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        id: "MockGoToDashboardDeviceAction",
        initial: "ready",
        states: {
          ready: {
            after: {
              0: "done",
            },
            entry: assign({
              intermediateValue: () => ({
                requiredUserInteraction: UserInteractionRequired.None,
              }),
            }),
          },
          done: {
            type: "final",
          },
        },
        output: () =>
          error
            ? Left(new UnknownDAError("GoToDashboard failed"))
            : Right(undefined),
      }),
    ),
  }));
};
