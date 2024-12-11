import {
  OpenAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

export const setupOpenAppDAMock = (error?: unknown) => {
  (OpenAppDeviceAction as jest.Mock).mockImplementation(() => ({
    makeStateMachine: jest.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
        states: {
          pending: {
            entry: assign({
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
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
        output: () => (error ? Left(error) : Right(undefined)),
      }),
    ),
  }));
};
