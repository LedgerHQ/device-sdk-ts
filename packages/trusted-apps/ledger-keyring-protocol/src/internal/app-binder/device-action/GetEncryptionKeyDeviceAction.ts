import {
  type DeviceActionStateMachine,
  type InternalApi,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Right } from "purify-ts";
import { fromPromise, setup } from "xstate";

import {
  type GetEncryptionKeyDAError,
  type GetEncryptionKeyDAInput,
  type GetEncryptionKeyDAIntermediateValue,
  type GetEncryptionKeyDAInternalState,
  type GetEncryptionKeyDAOutput,
} from "@api/app-binder/GetEncryptionKeyDeviceActionTypes";
import { type Keypair } from "@api/index";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { InitTask } from "@internal/app-binder/task/InitTask";
import {
  ParseStreamToDeviceTask,
  type ParseStreamToDeviceTaskInput,
} from "@internal/app-binder/task/ParseStreamToDeviceTask";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { required } from "@internal/utils/required";

import { raiseAndAssign } from "./utils/raiseAndAssign";

const APP_NAME = "Ledger Sync";

export class GetEncryptionKeyDeviceAction extends XStateDeviceAction<
  GetEncryptionKeyDAOutput,
  GetEncryptionKeyDAInput,
  GetEncryptionKeyDAError,
  GetEncryptionKeyDAIntermediateValue,
  GetEncryptionKeyDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GetEncryptionKeyDAOutput,
    GetEncryptionKeyDAInput,
    GetEncryptionKeyDAError,
    GetEncryptionKeyDAIntermediateValue,
    GetEncryptionKeyDAInternalState
  > {
    type types = StateMachineTypes<
      GetEncryptionKeyDAOutput,
      GetEncryptionKeyDAInput,
      GetEncryptionKeyDAError,
      GetEncryptionKeyDAIntermediateValue,
      GetEncryptionKeyDAInternalState
    >;

    const { getTrustchain, initCommand, parseStream } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        getTrustchain: fromPromise(getTrustchain),

        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),

        initCommand: fromPromise(initCommand),

        parseStream: fromPromise(parseStream),
      },

      actions: {
        assignErrorFromEvent: raiseAndAssign(
          ({ event }) =>
            Left(
              new UnknownDAError(String((event as { error?: unknown }).error)),
            ), // NOTE: it should never happen, the error is not typed anymore here
        ),
      },

      guards: {
        isTustchainEmpty: ({ context }) =>
          context._internalState
            .toMaybe()
            .chainNullable((state) => state.applicationStream)
            .chain((stream) => stream.parse().toMaybe())
            .map((blocks) => blocks.length === 0)
            .orDefault(true),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QFEB2sCuAnMBJWAsmALYBGYWAImAG4CWAxmAIIMAudA9qgHQDiYNgBUsGWGwYALAIZ1UAYgjcwPOTU4BrFTGGjxU2agDaABgC6iUAAdOsOh26WQAD0QBGEwE4eJgOwAWACZAoLdPEzd-T18AGhAAT0QANgBWEx40lMDfJN8AZhNClN8AXxK4tEwcfCIyCmp6JlYHXgFdMQkZOXkKLE4sHisAG2k2ADN+4h4dEQ6DOVMLJBAbOxanVwQPQJ9Cwt9tvLzfAA5AuMSEFOKfLLc8wJNjpKS8tzKK9Gw8QhJyKlojBY7C4rUEs30XQUmAYTFgsEWTlW9lBG0QeRS3k8KTex2uJn8xXOCUQpySPEeJ38BSSJzOJwiHxAlW+NT+9UBTRB3H44L0nUMPSwfSwiOWyPWy02GKxOPuvnxhN8xMuJzcGT2ewOmP8JxSTJZ1V+dQBjWBLR4AGFJGAGBo2SbYPI6LAAATEdmi8xI2woxxS5JJfwU-L+V5UoNuE55C6ITxJdXY6O0zz+A6eaMGr5G2r-BpA5qgq02u0O-5Ol2u1CcNjuz1i6y+yWgTYvYPZPJhvIR-xRmMkhBkikmKk0umBBnvcrM7M-XMcs2FnnW23243loUihsrJuogMINshzvhsO96OxhCPHYhTy3ycJ6kjrNVOee-Nci0AeSsYFQzCsViKMoqioOoWg8JwP5-gB24SnuLZxo8PCeIE0TZBE+SeHkSQXrk3jRicAQmB2tL+M+rLrguBbcrw36-v+gG9P0gwjOMkwQVBDGwbu-oIQgJy3hqpxhsRHh0v4F4pCc5Ldtc2JSfcvb6tOhqvia77mkWdHQYBMJwgi3rijxqBolsbgHD4gTHgUbgeKc-aqm4KQZGeJgJlJVKBOROZvpymk8tpDGbv03FrPBLjuOZ6rEdZER2eeA4PDst4pZiSRuZ4bheSps5llRH5FrgqD2PIelwAZSyNmFvERVsxy+BkSQhOZgRNWqEkDmciZSb2vheGG6V5N5al5n5S68EVJVMV6lU7tVJn7vKDUpE1vWtROkQXv41I8AqhStVhrVScNeWmtRFoAArSFgsBgAAymwODSMQpUYLC5WhX6C18W4QYNWcviA1J3bJhe9I8Hi9xqoEUYBCdlFnQVPJXTd92PWAz3BTNPrzaZv1pjwANAwRoMDitwZpPtuqA48TXw-OiP+bwK52gxQyMKMoIPU9xDIM4LpsPIn3NrVjy9hDBIrWExS+FhDmkm8GTRt28ZtSYymfC+p0aeNxarmzHMtNzGO8-z4hC24s1wTVmxi+qBSEgm2KA3LYPHD4vVZPGxzbVOmsUQzOs0TwzAQBAQicHzAtyFAxuY2V8LC+FtuEicu1qlGQTHNhHWquLlJpoUVLhK89O+Yuweh+HkdmxwqCx+jmPTUnNuICEUnp7ZnnZ0GF5DoElORJit5pmX6ljZXYcRwAcmAADuccvQnFU419pnt2npxd1n+S9wO+TOXtI5pqktInGPo0VxaVcz-Pi9Yy332i6nneZ1Zu+58keoUpTwRdQq1IL75SZjwPmj1pDsDQAwLA8QrAtAANJgHiK9d6idDJVTXvuCcTxCYZjuCtTEKRCQXmdhqQovYwweCoUAxmuswFYAgWwKBMC4GgkQcg5u6C5qYL4tgvIuC9QwwIdiYhA4S7IRSrLFI5k-AvDKNOasEA4BOFUtrCeItrZP02AAWjcBebRzkUpGOMVhJINCg4WjaBCAUchV4i02GmPuupkI9RhkEKyupsr+x8uPK+RYWZrgZvAIyuN9yeIkTDAS0jpFpk8H3V4w5i4Kmwi8J45j1FaU4gBOxydEDRnSKmHEZ9whSVTH3U4FJMpqgErZKMKF0l+J5JNNgOTW5bFQsGNyIRdQoS8G8WInVfoe3Mv4CIBJyGlBylrBGFiiwo1uovVpWj3CUx4OlSITwWovAVGDYIPBU66jeFEKIOQGnnX8SWDQBsGCc24IvKO4gll40BukaSKZZLJk-vxCchMFRQyyrDMiUyA7l3OTyG+Ndo710WSEnhosQjLVMYc-EGE3bOVQi1PqeRUz3C8TOaZgcMngqnpwWeC9G7ECeVg9au14x6kIm5UZ0Q+6oUJkcII0Q5a2SBd4kawC6HOHAZA1A0DYEIKQVS3hmJ1RnCeMRAeKYVRxmkUrTsWQiGdj6p4M5SNeB3TevpSVosMzkiwvkZJLx7idhIStXalM9SA1GU5HVIDkDCn6Ea22JrkLZwtQmdlYM6QQwTMRU40l8jYXkSUIAA */

      id: "GetEncryptionKeyDeviceAction",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          applicationStream: null,
          trustchain: null,
          sessionKeypair: null,
          signedBlock: null,
          encryptionKey: null,
        }),
      }),

      initial: "GetTrustchain",
      states: {
        GetTrustchain: {
          on: { success: "CheckIsMembers", error: "Error" },
          invoke: {
            id: "getTrustchain",
            src: "getTrustchain",
            input: ({ context }) => context.input,
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(({ trustchain, applicationStream }) => ({
                  raise: "success",
                  assign: { trustchain, applicationStream },
                })),
              ),
            },
          },
        },

        CheckIsMembers: {
          on: {
            "is member": "ExtractEncryptionKey",
            "is not member": "OpenApp",
            error: "Error",
          },
          entry: raiseAndAssign(({ context }) =>
            eitherSeqRecord({
              stream: () =>
                context._internalState.map((state) => state.applicationStream),
              member: () =>
                context.input.map(({ keypair }) => keypair.publicKey),
            }).map(({ stream, member }) => ({
              raise: stream?.hasMember(member) ? "is member" : "is not member",
            })),
          ),
        },

        OpenApp: {
          on: { success: "Init", error: "Error" },
          invoke: {
            id: "openApp",
            src: "openAppStateMachine",
            input: { appName: APP_NAME },
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(() => ({ raise: "success" })),
              ),
            },
          },
        },

        Init: {
          on: { success: "ParseStream", error: "Error" },
          invoke: {
            id: "initCommand",
            src: "initCommand",
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map((sessionKeypair) => ({
                  raise: "success",
                  assign: { sessionKeypair },
                })),
              ),
            },
          },
        },

        ParseStream: {
          on: { success: "CheckApplicationStreamExist", error: "Error" },
          invoke: {
            id: "parseStream",
            src: "parseStream",
            input: ({ context }) =>
              context._internalState.chain((state) =>
                required(state.trustchain?.["m/"], "Missing root stream")
                  .chain((rootStream) => rootStream.parse())
                  .chain((blocks) => required(blocks[0], "Missing seed block"))
                  .map((seedBlock) => ({
                    seedBlock,
                    applicationStream: state.applicationStream,
                  })),
              ),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event, context }) =>
                event.output
                  .map(() => ({ raise: "success" }))
                  .ifRight(() => {
                    context._internalState.ifRight((state) => {
                      console.log("Stream parsed successfully!!!", state);
                    });
                  }),
              ),
            },
          },
        },

        CheckApplicationStreamExist: {
          always: [
            { target: "AddToNewStream", guard: "isTustchainEmpty" },
            { target: "AddToExistingStream" },
          ],
        },

        AddToExistingStream: {
          on: { success: "ExtractEncryptionKey", error: "Error" },
          // TODO: Implement AddToExistingStream
        },

        AddToNewStream: {
          on: { success: "ExtractEncryptionKey", error: "Error" },
          // TODO: Implement AddToNewStream
        },

        ExtractEncryptionKey: {
          on: { success: "Success", error: "Error" },
          // TODO: Implement ExtractEncryptionKey
        },

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) =>
        context._internalState.chain((state) =>
          eitherSeqRecord({
            applicationPath: () =>
              required(
                state.applicationStream?.getPath().extract(),
                "Missing application path in the output",
              ),
            encryptionKey: () =>
              required(
                state.encryptionKey,
                "Missing encryption key in the output",
              ),
          }),
        ),
    });
  }

  extractDependencies(internalApi: InternalApi) {
    return {
      getTrustchain: (args: { input: GetEncryptionKeyDAInput }) =>
        EitherAsync.liftEither(args.input)
          .chain(({ applicationId, lkrpDataSource, trustchainId, jwt }) =>
            lkrpDataSource
              .getTrustchainById(trustchainId, jwt)
              .map((trustchain) => ({
                trustchain,
                applicationStream: trustchain[`m/${applicationId}'`] ?? null,
              })),
          )
          .run(),

      initCommand: (): Promise<Either<LKRPDeviceCommandError, Keypair>> =>
        new InitTask(internalApi).run(),

      parseStream: async (args: {
        input: Either<GetEncryptionKeyDAError, ParseStreamToDeviceTaskInput>;
      }) =>
        EitherAsync.liftEither(args.input)
          .chain<GetEncryptionKeyDAError, unknown>((input) =>
            new ParseStreamToDeviceTask(internalApi).run(input),
          )
          .run(),
    };
  }
}
