import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { assign, createMachine } from "xstate";

import { type PsbtSignature } from "@api/model/Signature";
import { SignPsbtDeviceAction } from "@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction";

export const setupSignPsbtDAMock = (
  sigs: PsbtSignature[] = [],
  error?: unknown,
) => {
  // setupOpenAppDAMock();
  (SignPsbtDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
        states: {
          pending: {
            entry: assign({
              intermediateValue: {
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
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
        output: () => (error ? Left(error) : Right(sigs)),
      }),
    ),
  }));
};
