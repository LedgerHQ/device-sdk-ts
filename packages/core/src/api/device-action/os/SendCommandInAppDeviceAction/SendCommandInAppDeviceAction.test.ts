import { Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import {
  CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { GlobalCommandErrorStatusCode } from "@api/command/utils/GlobalCommandError";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import {
  DeviceActionState,
  DeviceActionStatus,
} from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { OpenAppDeviceAction } from "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction";
import { Command } from "@api/types";

import { SendCommandInAppDeviceAction } from "./SendCommandInAppDeviceAction";
import {
  SendCommandInAppDAError,
  SendCommandInAppDAIntermediateValue,
  SendCommandInAppDAOutput,
} from "./SendCommandInAppDeviceActionTypes";

jest.mock(
  "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  () => ({
    ...jest.requireActual(
      "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction",
    ),
    OpenAppDeviceAction: jest.fn(() => ({
      makeStateMachine: jest.fn(),
    })),
  }),
);

const setupOpenAppDAMock = (error?: unknown) => {
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

describe("SendCommandInAppDeviceAction", () => {
  const sendMyCommand = jest.fn();

  const extractDependenciesMock = () => ({
    sendCommand: sendMyCommand,
  });

  const { sendCommand: apiSendCommandMock } = makeDeviceActionInternalApiMock();

  const commandParams = {
    paramString: "aParameter",
    paramNumber: 1234,
  };
  const mockedCommandResponse = CommandResultFactory({
    data: {
      aNumber: 5678,
      aString: "mockedResponseString",
    },
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("without mocking extractDependencies", () => {
    it("should call sendCommand on internalApi with the correct parameters", async () => {
      setupOpenAppDAMock();

      const deviceAction = new SendCommandInAppDeviceAction({
        input: {
          command: new TestCommand(commandParams),
          appName: "MyApp",
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
    it("should error and output the error if the open app fails", (done) => {
      setupOpenAppDAMock(new UnknownDAError("Mocked error"));

      const expectedStates: MyCommandSendCommandDAState[] = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError("Mocked error"),
        },
      ];

      testDeviceActionStates(
        new SendCommandInAppDeviceAction({
          input: {
            command: new TestCommand(commandParams),
            appName: "MyApp",
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
          },
        }),
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should error and output an error if the send command fails", (done) => {
      setupOpenAppDAMock();

      sendMyCommand.mockRejectedValue(new Error("Mocked error"));

      const deviceAction = new SendCommandInAppDeviceAction({
        input: {
          command: new TestCommand(commandParams),
          appName: "MyApp",
          requiredUserInteraction: UserInteractionRequired.VerifyAddress,
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockImplementation(extractDependenciesMock);

      const expectedStates: MyCommandSendCommandDAState[] = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError("Error while sending the custom command"),
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
  });

  describe("success cases", () => {
    it("should succeed and output the command result if the send command succeeds", (done) => {
      setupOpenAppDAMock();

      sendMyCommand.mockResolvedValue(mockedCommandResponse);

      const deviceAction = new SendCommandInAppDeviceAction({
        input: {
          command: new TestCommand(commandParams),
          appName: "MyApp",
          requiredUserInteraction: UserInteractionRequired.VerifyAddress,
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockImplementation(extractDependenciesMock);

      const expectedStates: MyCommandSendCommandDAState[] = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
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
        done,
      );
    });
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

class TestCommand
  implements
    Command<MyCommandResponse, GlobalCommandErrorStatusCode, MyCommandParams>
{
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

type MyCommandSendCommandDAState = DeviceActionState<
  SendCommandInAppDAOutput<
    CommandResult<MyCommandResponse, GlobalCommandErrorStatusCode>
  >,
  SendCommandInAppDAError<UnknownDAError>,
  SendCommandInAppDAIntermediateValue<
    UserInteractionRequired.None | UserInteractionRequired.VerifyAddress
  >
>;
