import {
  UserInteractionRequired,
  WaitForAppAndVersionDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { createMachine } from "xstate";

/**
 * Mock WaitForAppAndVersionDeviceAction to resolve immediately with either a
 * fresh `{ name, version }` (default) or an error.
 *
 * The mock machine carries an `intermediateValue` in its context (matching the
 * real DA) so the parent's onSnapshot propagation has a defined value to read.
 * Pass `requiredUserInteraction` to have the child emit an interaction (e.g.
 * UnlockDevice for a locked device) before completing.
 */
export const setupWaitForAppAndVersionDAMock = (
  result: { name: string; version: string } | { error: unknown } = {
    name: "Ethereum",
    version: "1.15.0",
  },
  requiredUserInteraction: UserInteractionRequired = UserInteractionRequired.None,
) => {
  (WaitForAppAndVersionDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
        context: {
          intermediateValue: { requiredUserInteraction },
        },
        states: {
          pending: {
            after: {
              0: "done",
            },
          },
          done: {
            type: "final",
          },
        },
        output: () => ("error" in result ? Left(result.error) : Right(result)),
      }),
    ),
  }));
};
