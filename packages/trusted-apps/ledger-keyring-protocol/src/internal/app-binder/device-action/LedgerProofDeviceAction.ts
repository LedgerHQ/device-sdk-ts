import {
  CommandResultStatus,
  type DeviceActionStateMachine,
  type InternalApi,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type LedgerProofDAError,
  type LedgerProofDAInput,
  type LedgerProofDAIntermediateValue,
  type LedgerProofDAInternalState,
  type LedgerProofDAOutput,
  LedgerProofDAStep,
} from "@api/app-binder/LedgerProofDeviceActionTypes";
import { LKRPUnknownError } from "@api/model/Errors";

import { LedgerProofGetResponseCommand } from "../command/LedgerProofGetResponseCommand";
import { LedgerProofSendChunkCommand } from "../command/LedgerProofSendChunkCommand";
import { raiseAndAssign } from "./utils/raiseAndAssign";

const APP_NAME = "Ledger Proof";
const INS_ENCRYPT = 0x10;
const INS_DECRYPT = 0x11;
const CHUNK_SIZE = 250;

export class LedgerProofDeviceAction extends XStateDeviceAction<
  LedgerProofDAOutput,
  LedgerProofDAInput,
  LedgerProofDAError,
  LedgerProofDAIntermediateValue,
  LedgerProofDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    LedgerProofDAOutput,
    LedgerProofDAInput,
    LedgerProofDAError,
    LedgerProofDAIntermediateValue,
    LedgerProofDAInternalState
  > {
    type types = StateMachineTypes<
      LedgerProofDAOutput,
      LedgerProofDAInput,
      LedgerProofDAError,
      LedgerProofDAIntermediateValue,
      LedgerProofDAInternalState
    >;

    const { executeOperation } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),

        executeOperation: fromPromise(executeOperation),
      },

      actions: {
        assignErrorFromEvent: raiseAndAssign(
          ({ event }) =>
            Left(
              new LKRPUnknownError(
                String((event as { error?: unknown }).error),
              ),
            ),
        ),
      },
    }).createMachine({
      id: "LedgerProofDeviceAction",
      context: ({ input }): types["context"] => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          result: null,
        }),
      }),

      initial: "OpenApp",
      states: {
        OpenApp: {
          on: { success: "ExecuteOperation", error: "Error" },
          invoke: {
            id: "openApp",
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: ({
                  event,
                }): LedgerProofDAIntermediateValue => ({
                  ...event.snapshot.context.intermediateValue,
                  step: LedgerProofDAStep.OpenApp,
                }),
              }),
            },
            input: { appName: APP_NAME },
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(() => ({ raise: "success" })),
              ),
            },
          },
        },

        ExecuteOperation: {
          entry: assign({
            intermediateValue: {
              step: LedgerProofDAStep.ExecuteOperation,
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          on: { success: "Success", error: "Error" },
          invoke: {
            id: "executeOperation",
            src: "executeOperation",
            input: ({ context }) => context.input,
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map((result: Uint8Array) => ({
                  raise: "success",
                  assign: { result },
                })),
              ),
            },
          },
        },

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) =>
        context._internalState.chain((state) => {
          if (!state.result) {
            return Left(
              new LKRPUnknownError("Missing result in the output"),
            );
          }
          return Right(state.result);
        }),
    });
  }

  extractDependencies(internalApi: InternalApi) {
    return {
      executeOperation: async ({
        input,
      }: {
        input: LedgerProofDAInput;
      }): Promise<Either<LedgerProofDAError, Uint8Array>> => {
        const ins =
          input.operation === "encrypt" ? INS_ENCRYPT : INS_DECRYPT;

        const chunks: Uint8Array[] = [];
        for (let i = 0; i < input.data.length; i += CHUNK_SIZE) {
          chunks.push(input.data.slice(i, i + CHUNK_SIZE));
        }
        if (chunks.length === 0) {
          chunks.push(new Uint8Array(0));
        }

        let moreFlag = 0;
        let lastData: Uint8Array<ArrayBuffer> = new Uint8Array(0);

        for (let i = 0; i < chunks.length; i++) {
          const isLast = i === chunks.length - 1;
          const result = await internalApi.sendCommand(
            new LedgerProofSendChunkCommand({
              ins,
              chunkIndex: i,
              isLast,
              data: chunks[i]!,
            }),
          );
          if (result.status !== CommandResultStatus.Success) {
            return Left(result.error);
          }
          moreFlag = result.data.moreFlag;
          lastData = new Uint8Array(result.data.data);
        }

        const responseChunks: Uint8Array<ArrayBuffer>[] = [lastData];

        while (moreFlag === 0x01) {
          const result = await internalApi.sendCommand(
            new LedgerProofGetResponseCommand(),
          );
          if (result.status !== CommandResultStatus.Success) {
            return Left(result.error);
          }
          moreFlag = result.data.moreFlag;
          responseChunks.push(new Uint8Array(result.data.data));
        }

        const totalLength = responseChunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0,
        );
        const assembled = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of responseChunks) {
          assembled.set(chunk, offset);
          offset += chunk.length;
        }

        return Right(assembled);
      },
    };
  }
}
