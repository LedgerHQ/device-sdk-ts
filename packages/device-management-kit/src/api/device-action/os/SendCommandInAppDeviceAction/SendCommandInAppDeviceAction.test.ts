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
import { type Command } from "@api/types";
import { UnknownDeviceExchangeError } from "@root/src";

import { SendCommandInAppDeviceAction } from "./SendCommandInAppDeviceAction";
import {
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
} from "./SendCommandInAppDeviceActionTypes";

vi.mock(
  "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("../OpenAppDeviceAction/OpenAppDeviceAction")
      >();

    return {
      ...original,
      OpenAppDeviceAction: vi.fn(() => ({
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
  const sendMyCommand = vi.fn();

  const extractDependenciesMock = () => ({
    sendCommand: sendMyCommand,
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

      const deviceAction = new SendCommandInAppDeviceAction({
        input: {
          command: new TestCommand(commandParams),
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

    it("should error and output an error if the send command fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        sendMyCommand.mockResolvedValue(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const deviceAction = new SendCommandInAppDeviceAction({
          input: {
            command: new TestCommand(commandParams),
            appName: "MyApp",
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            skipOpenApp: false,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(
          extractDependenciesMock,
        );

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

        sendMyCommand.mockResolvedValue(
          CommandResultFactory({ data: mockedCommandResponse }),
        );

        const deviceAction = new SendCommandInAppDeviceAction({
          input: {
            command: new TestCommand(commandParams),
            appName: "MyApp",
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            skipOpenApp: false,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(
          extractDependenciesMock,
        );

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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should succeed while skipping OpenApp", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        sendMyCommand.mockResolvedValue(
          CommandResultFactory({ data: mockedCommandResponse }),
        );

        const deviceAction = new SendCommandInAppDeviceAction({
          input: {
            command: new TestCommand(commandParams),
            appName: "MyApp",
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            skipOpenApp: true,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(
          extractDependenciesMock,
        );

        const expectedStates: MyCommandSendCommandDAState[] = [
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
  SendCommandInAppDAOutput<MyCommandResponse>,
  SendCommandInAppDAError<UnknownDAError>,
  SendCommandInAppDAIntermediateValue<
    UserInteractionRequired.None | UserInteractionRequired.VerifyAddress
  >
>;
