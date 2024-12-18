import {
  ApduResponse,
  CommandResultFactory,
  type DmkError,
  type InternalApi,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { type DataStore } from "@internal/data-store/model/DataStore";

describe("ContinueTask", () => {
  const clientCommandInterpreter = {
    getClientCommandPayload: jest.fn(
      () => Right(Uint8Array.from([])) as Either<DmkError, Uint8Array>,
    ),
  };
  const api = {
    sendCommand: jest.fn(),
  };
  const randomNumberOfClientCalls = Math.floor(Math.random() * 10 + 2);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it(`should call ${randomNumberOfClientCalls} times client interpreter and return success`, async () => {
    // given
    new Array(randomNumberOfClientCalls).fill(0).forEach((_) => {
      api.sendCommand.mockReturnValueOnce(
        CommandResultFactory({
          data: new ApduResponse({
            statusCode: Uint8Array.from([0xe0, 0x00]),
            data: Uint8Array.from([]),
          }),
        }),
      );
    });
    api.sendCommand.mockReturnValueOnce(
      CommandResultFactory({
        data: new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([]),
        }),
      }),
    );
    const fromResult = CommandResultFactory<ApduResponse, BtcErrorCodes>({
      data: new ApduResponse({
        statusCode: Uint8Array.from([0xe0, 0x00]),
        data: Uint8Array.from([]),
      }),
    });
    // when
    const task = new ContinueTask(
      api as unknown as InternalApi,
      clientCommandInterpreter,
    );
    await task.run({} as DataStore, fromResult);
    // then
    expect(
      clientCommandInterpreter.getClientCommandPayload,
    ).toHaveBeenCalledTimes(randomNumberOfClientCalls + 1);
  });

  it("should return an error if the client interpreter fails", async () => {
    // given
    const error = new UnknownDeviceExchangeError("Failed");
    clientCommandInterpreter.getClientCommandPayload.mockReturnValueOnce(
      Left(error),
    );
    const fromResult = CommandResultFactory<ApduResponse, BtcErrorCodes>({
      data: new ApduResponse({
        statusCode: Uint8Array.from([0xe0, 0x00]),
        data: Uint8Array.from([]),
      }),
    });
    // when
    const task = new ContinueTask(
      api as unknown as InternalApi,
      clientCommandInterpreter,
    );
    const result = await task.run({} as DataStore, fromResult);
    // then
    expect(api.sendCommand).toHaveBeenCalledTimes(0);
    expect(result).toStrictEqual(
      CommandResultFactory({ error: new UnknownDeviceExchangeError(error) }),
    );
  });
  it("should return an error if send command fails", async () => {
    // given
    const error = new UnknownDeviceExchangeError("Failed");
    api.sendCommand.mockReturnValueOnce(CommandResultFactory({ error }));
    const fromResult = CommandResultFactory<ApduResponse, BtcErrorCodes>({
      data: new ApduResponse({
        statusCode: Uint8Array.from([0xe0, 0x00]),
        data: Uint8Array.from([]),
      }),
    });
    // when
    const task = new ContinueTask(
      api as unknown as InternalApi,
      clientCommandInterpreter,
    );
    const result = await task.run({} as DataStore, fromResult);
    // then
    expect(
      clientCommandInterpreter.getClientCommandPayload,
    ).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(CommandResultFactory({ error }));
  });
});
