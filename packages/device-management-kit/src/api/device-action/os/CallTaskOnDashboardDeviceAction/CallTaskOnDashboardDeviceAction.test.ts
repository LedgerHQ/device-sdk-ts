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
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import { goToDashboardDAStateStep } from "@api/device-action/os/GoToDashboard/types";
import { DmkResultFactory } from "@api/model/DmkResult";
import { type Command } from "@api/types";
import { UnknownDeviceExchangeError } from "@root/src";

import { CallTaskOnDashboardDeviceAction } from "./CallTaskOnDashboardDeviceAction";
import {
  type CallTaskOnDashboardDAError,
  type CallTaskOnDashboardDAIntermediateValue,
  type CallTaskOnDashboardDAOutput,
  callTaskOnDashboardDAStateStep,
} from "./CallTaskOnDashboardDeviceActionTypes";

vi.mock(
  "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction")
      >();
    return {
      ...original,
      GoToDashboardDeviceAction: vi.fn(() => ({
        ...original.GoToDashboardDeviceAction,
        makeStateMachine: vi.fn(),
      })),
    };
  },
);

const setupGoToDashboardDAMock = (error?: unknown) => {
  (GoToDashboardDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
        states: {
          pending: {
            entry: assign({
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
                step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
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

describe("CallTaskOnDashboardDeviceAction", () => {
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
      setupGoToDashboardDAMock();
      apiSendCommandMock.mockResolvedValue(
        CommandResultFactory({ data: undefined }),
      );

      const deviceAction = new CallTaskOnDashboardDeviceAction({
        input: {
          task: async (internalApi) =>
            await internalApi.sendCommand(new TestCommand(commandParams)),
          requiredUserInteraction: UserInteractionRequired.VerifyAddress,
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
    it("should error and output the error if GoToDashboard fails", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardDAMock(new UnknownDAError("Mocked error"));

        const expectedStates: MyCommandCallTaskDAState[] = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: callTaskOnDashboardDAStateStep.GO_TO_DASHBOARD,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDAError("Mocked error"),
          },
        ];

        testDeviceActionStates(
          new CallTaskOnDashboardDeviceAction({
            input: {
              task: async (internalApi) =>
                await internalApi.sendCommand(new TestCommand(commandParams)),
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
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
        setupGoToDashboardDAMock();

        callMyTask.mockResolvedValue(
          DmkResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const deviceAction = new CallTaskOnDashboardDeviceAction({
          input: {
            task: async (internalApi) =>
              await internalApi.sendCommand(new TestCommand(commandParams)),
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
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
              step: callTaskOnDashboardDAStateStep.GO_TO_DASHBOARD,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              step: callTaskOnDashboardDAStateStep.CALL_TASK,
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
    it("should succeed and output the command result once on the dashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardDAMock();

        callMyTask.mockResolvedValue(
          DmkResultFactory({ data: mockedCommandResponse }),
        );

        const deviceAction = new CallTaskOnDashboardDeviceAction({
          input: {
            task: async (internalApi) =>
              await internalApi.sendCommand(new TestCommand(commandParams)),
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
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
              step: callTaskOnDashboardDAStateStep.GO_TO_DASHBOARD,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              step: callTaskOnDashboardDAStateStep.CALL_TASK,
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
  CallTaskOnDashboardDAOutput<MyCommandResponse>,
  CallTaskOnDashboardDAError<UnknownDAError | UnknownDeviceExchangeError>,
  CallTaskOnDashboardDAIntermediateValue<
    UserInteractionRequired.None | UserInteractionRequired.VerifyAddress
  >
>;
