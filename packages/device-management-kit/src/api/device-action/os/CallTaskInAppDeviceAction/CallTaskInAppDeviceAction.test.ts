/* eslint @typescript-eslint/consistent-type-imports:0 */
import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { assign, createMachine } from "xstate";

import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import {
  type DeviceActionState,
  DeviceActionStatus,
} from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { OpenAppDeviceAction } from "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction";
import { openAppDAStateStep } from "@api/device-action/os/OpenAppDeviceAction/types";
import { type Command } from "@api/types";
import { UnknownDeviceExchangeError } from "@root/src";

import { CallTaskInAppDeviceAction } from "./CallTaskInAppDeviceAction";
import {
  type CallTaskInAppDAError,
  type CallTaskInAppDAIntermediateValue,
  type CallTaskInAppDAOutput,
  callTaskInAppDAStateStep,
} from "./CallTaskInAppDeviceActionTypes";

vi.mock(
  "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction")
      >();
    return {
      ...original,
      OpenAppDeviceAction: vi.fn(() => ({
        ...original.OpenAppDeviceAction,
        makeStateMachine: vi.fn(),
      })),
    };
  },
);

const setupOpenAppDAMock = (error?: unknown) => {
  (OpenAppDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
        states: {
          pending: {
            entry: assign({
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
                step: openAppDAStateStep.GET_DEVICE_STATUS,
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

describe("CallTaskInAppDeviceAction", () => {
  const callMyTask = vi.fn();

  const extractDependenciesMock = () => ({
    callTask: callMyTask,
  });

  const { sendCommand: apiSendCommandMock } = makeDeviceActionInternalApiMock();

  const commandParams = {
    paramString: "aParameter",
    paramNumber: 1234,
  };
  const mockedCommandResponse = {
    aNumber: 5678,
    aString: "mockedResponseString",
  };
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("without mocking extractDependencies", () => {
    it("should call sendCommand on internalApi with the correct parameters", async () => {
      setupOpenAppDAMock();
      apiSendCommandMock.mockResolvedValue(
        CommandResultFactory({ data: undefined }),
      );

      const deviceAction = new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            await internalApi.sendCommand(new TestCommand(commandParams)),
          appName: "MyApp",
          requiredUserInteraction: UserInteractionRequired.VerifyAddress,
          skipOpenApp: false,
        },
      });
      await new Promise<void>((resolve, reject) => {
        deviceAction
          ._execute(makeDeviceActionInternalApiMock())
          .observable.subscribe({
            error: () => reject(),
            complete: () => resolve(),
            next: () => {},
          });
      });

      expect(apiSendCommandMock).toHaveBeenCalledWith(
        new TestCommand(commandParams),
      );
    });
  });

  describe("error cases", () => {
    it("should error and output the error if the open app fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock(new UnknownDAError("Mocked error"));

        const expectedStates: MyCommandCallTaskDAState[] = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: callTaskInAppDAStateStep.OPEN_APP,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: openAppDAStateStep.GET_DEVICE_STATUS,
            },
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDAError("Mocked error"),
          },
        ];

        testDeviceActionStates(
          new CallTaskInAppDeviceAction({
            input: {
              task: async (internalApi) =>
                await internalApi.sendCommand(new TestCommand(commandParams)),
              appName: "MyApp",
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              skipOpenApp: false,
            },
          }),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should error and output an error if the call task fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        callMyTask.mockResolvedValue(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const deviceAction = new CallTaskInAppDeviceAction({
          input: {
            task: async (internalApi) =>
              await internalApi.sendCommand(new TestCommand(commandParams)),
            appName: "MyApp",
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            skipOpenApp: false,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(
          extractDependenciesMock,
        );

        const expectedStates: MyCommandCallTaskDAState[] = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: callTaskInAppDAStateStep.OPEN_APP,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: openAppDAStateStep.GET_DEVICE_STATUS,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              step: callTaskInAppDAStateStep.CALL_TASK,
            },
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDeviceExchangeError("Mocked error"),
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });

  describe("success cases", () => {
    it("should succeed and output the command result if the send command succeeds", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        callMyTask.mockResolvedValue(
          CommandResultFactory({ data: mockedCommandResponse }),
        );

        const deviceAction = new CallTaskInAppDeviceAction({
          input: {
            task: async (internalApi) =>
              await internalApi.sendCommand(new TestCommand(commandParams)),
            appName: "MyApp",
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            skipOpenApp: false,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(
          extractDependenciesMock,
        );

        const expectedStates: MyCommandCallTaskDAState[] = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: callTaskInAppDAStateStep.OPEN_APP,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: openAppDAStateStep.GET_DEVICE_STATUS,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              step: callTaskInAppDAStateStep.CALL_TASK,
            },
          },
          {
            status: DeviceActionStatus.Completed,
            output: mockedCommandResponse,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should succeed while skipping OpenApp", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        callMyTask.mockResolvedValue(
          CommandResultFactory({ data: mockedCommandResponse }),
        );

        const deviceAction = new CallTaskInAppDeviceAction({
          input: {
            task: async (internalApi) =>
              await internalApi.sendCommand(new TestCommand(commandParams)),
            appName: "MyApp",
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            skipOpenApp: true,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(
          extractDependenciesMock,
        );

        const expectedStates: MyCommandCallTaskDAState[] = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              step: callTaskInAppDAStateStep.CALL_TASK,
            },
          },
          {
            status: DeviceActionStatus.Completed,
            output: mockedCommandResponse,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });
});

type MyCommandResponse = {
  aNumber: number;
  aString: string;
};

type MyCommandParams = {
  paramString: string;
  paramNumber: number;
};

class TestCommand implements Command<MyCommandResponse, MyCommandParams> {
  readonly name = "testCommand";

  params: MyCommandParams;
  constructor(params: MyCommandParams) {
    this.params = params;
  }
  getApdu(): Apdu {
    return new ApduBuilder({ cla: 0x00, ins: 0x01, p1: 0x02, p2: 0x03 })
      .add32BitUIntToData(this.params.paramNumber)
      .addAsciiStringToData(this.params.paramString)
      .build();
  }
  parseResponse() {
    return CommandResultFactory({ data: { aNumber: 1, aString: "aString" } });
  }
}

type MyCommandCallTaskDAState = DeviceActionState<
  CallTaskInAppDAOutput<MyCommandResponse>,
  CallTaskInAppDAError<UnknownDAError>,
  CallTaskInAppDAIntermediateValue<
    UserInteractionRequired.None | UserInteractionRequired.VerifyAddress
  >
>;
