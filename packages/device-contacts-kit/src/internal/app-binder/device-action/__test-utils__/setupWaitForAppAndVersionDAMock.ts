import { WaitForAppAndVersionDeviceAction } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { createMachine } from "xstate";

/**
 * Mock WaitForAppAndVersionDeviceAction to resolve immediately with either a
 * fresh `{ name, version }` (default) or an error. No user interaction is
 * emitted (the device is assumed unlocked).
 */
export const setupWaitForAppAndVersionDAMock = (
  result: { name: string; version: string } | { error: unknown } = {
    name: "Ethereum",
    version: "1.15.0",
  },
) => {
  (WaitForAppAndVersionDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
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
