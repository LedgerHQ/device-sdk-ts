import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { CommandResult } from "@api/command/model/CommandResult";
import { InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { OpenAppDeviceAction } from "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import { XStateDeviceAction } from "@api/device-action/xstate-utils/XStateDeviceAction";
import { SdkError } from "@api/Error";
import { Command } from "@api/types";

import {
  SendCommandInAppDAError,
  SendCommandInAppDAInput,
  SendCommandInAppDAIntermediateValue,
  SendCommandInAppDAInternalState,
  SendCommandInAppDAOutput,
} from "./SendCommandInAppDeviceActionTypes";

/**
 * Tries to open an app on the device, and if it is successful, sends a command
 * to the app.
 * The output will be the result of the command.
 *
 * ```ts
 * input: {
 *  appName: string;
 *  command: Command<CommandResult, CommandArgs>;
 *  requiredUserInteraction: UserInteraction;
 * }
 * ```
 *
 * Example of usage:
 *
 * ```ts
 * const deviceAction = new SendCommandInAppDeviceAction({
 *  input: {
 *   appName: "MyApp",
 *   command: new MyAppSpecificCommand({commandSpecificArg: "foo"}),
 *   requiredUserInteraction: UserInteractionRequired.None,
 *  },
 * });
 * sdk.executeDeviceAction({ sessionId: "mySessionId", deviceAction });
 * ```
 */
export class SendCommandInAppDeviceAction<
  CommandArgs,
  CommandResponse,
  CommandError extends SdkError,
  UserInteraction extends UserInteractionRequired,
  CommandErrorCodes,
> extends XStateDeviceAction<
  SendCommandInAppDAOutput<CommandResult<CommandResponse, CommandErrorCodes>>,
  SendCommandInAppDAInput<
    CommandResponse,
    CommandArgs,
    UserInteraction,
    CommandErrorCodes
  >,
  SendCommandInAppDAError<CommandError>,
  SendCommandInAppDAIntermediateValue<UserInteraction>,
  SendCommandInAppDAInternalState<
    CommandResponse,
    CommandErrorCodes,
    CommandError
  >
> {
  makeStateMachine(internalAPI: InternalApi) {
    type types = StateMachineTypes<
      SendCommandInAppDAOutput<
        CommandResult<CommandResponse, CommandErrorCodes>
      >,
      SendCommandInAppDAInput<
        CommandResponse,
        CommandArgs,
        UserInteraction,
        CommandErrorCodes
      >,
      SendCommandInAppDAError<CommandError>,
      SendCommandInAppDAIntermediateValue<UserInteraction>,
      SendCommandInAppDAInternalState<
        CommandResponse,
        CommandErrorCodes,
        CommandError
      >
    >;

    const { sendCommand } = this.extractDependencies(internalAPI);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        sendCommand: fromPromise(sendCommand),
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: this.input.appName },
        }).makeStateMachine(internalAPI),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QFEAuALA0mAngJwEsA7KAcTFQEEII85YARMANwIGMxK3UCB7IgHQB5AA5gilESKasOXHvwDEEfmAHFmvANZreYiVIDKqAIaowAWRNt0xMAG0ADAF1EoEb1gEFRNyAAeiACMQQDsAgAcACwAzKEArABMUfGpEQCcEYkANCA4iFGO8QKhjokxERUpQenp8QC+9bloWLiEJORUNHSwjCzsnNx8ggDC6GBsWqLiktL9ckP8AEpwAK4ANqiKTq5IIB5ePn6BCEFR4YkAbKE1Zemh55URufkI8fcC8TGXl0EVoelHJcio1mhhsPhiGQKNRaPQZAN5MMBGMJlN9LMEQsfCtYBstvYgrt3J5vMNjgUQgJLokHlEgldko50rEXoh3uEvj8-hEAUCQU0QC0Ie1oV04b0sYMfAJOrCerARrwALbKkxECDKVTqIiaHQCGDihVK1XqiA7PwHMn8CmnRJBASOFIxKJXJ21GLpHJ5RARGoCEL3CKXDLpS4pCKgoXgtpQuXdeHzaXI+MSxUqtUaxRgPB4Xh4AQidZmABm+eVBphCd6Jsz5pcltJRz2Jyiv0dvIeNJi8UqoWePoQIccn3iId+sSqkajRF4EDgfmFsY6VbTUqRNr2VuboBOAFpLmzTpd0iV+0EkkEylcAVEo0vISujYnZMn+MIMVJ14tfFum+SWwKb1XkSMdIhuQFEidYNSjvQUH1FVMFW-GVUUmaYDDmV8NyIXF8UbQ4AN3X0ogEF17S9eJQhiJ0ojbI8khHc54mvRwGUBXl7xjR8xXlF9ER-WVV2NDMzQI61f2IhBXUdRw5NDX54gvXkjx+CIzxuMdfnKd44LBVoeKQ-jsWRQxVjYDhenEncAmCcMBHKBlqKyIEYivGIjzDGJqQSYMamDa4BX0kU42E4y30EZBc3zayiNshBSmKFjqn7GCMgHV57lIz0aT9P0lL+S5GkaIA */
      id: "SendCommandInAppDeviceAction",
      initial: "OpenAppDeviceAction",
      context: ({ input }) => {
        return {
          input: input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            commandResponse: null,
            error: null,
          },
        };
      },
      states: {
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            input: { appName: this.input.appName },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<
                    SendCommandInAppDAInternalState<
                      CommandResponse,
                      CommandErrorCodes,
                      CommandError
                    >
                  >({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  });
                },
              }),
              target: "CheckOpenAppDeviceActionResult",
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            {
              target: "SendCommand",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        SendCommand: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: this.input.requiredUserInteraction,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "sendCommand",
            src: "sendCommand",
            input: ({ context }) => context.input.command,
            onDone: {
              target: "Success",
              actions: [
                // TODO: when we have proper error handling, we should handle the error here
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    commandResponse: event.output,
                  }),
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: [
                assign({
                  _internalState: (_) => ({
                    ..._.context._internalState,
                    error: new UnknownDAError(
                      "Error while sending the custom command",
                    ),
                  }),
                }),
              ],
            },
          },
        },
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: ({ context }) =>
        context._internalState.commandResponse
          ? Right(context._internalState.commandResponse)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi) {
    return {
      sendCommand: (_: {
        input: Command<CommandResponse, CommandErrorCodes, CommandArgs>;
      }): Promise<CommandResult<CommandResponse, CommandErrorCodes>> =>
        internalApi.sendCommand(_.input),
    };
  }
}
