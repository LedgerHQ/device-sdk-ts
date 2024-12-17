import {
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  type CommandSuccessResult,
  type InternalApi,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import { type ClientCommandContext } from "@internal/app-binder/command/client-command-handlers/ClientCommandHandlersTypes";
import {
  ContinueCommand,
  type ContinueCommandResponse,
} from "@internal/app-binder/command/ContinueCommand";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import { type BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { CommandUtils } from "@internal/utils/CommandUtils";

export class ContinueTask {
  constructor(private readonly _api: InternalApi) {}

  async run(
    dataStore: DataStore,
    fromResult: CommandResult<ApduResponse, BitcoinAppErrorCodes>,
  ): Promise<CommandResult<ContinueCommandResponse, BitcoinAppErrorCodes>> {
    let currentResponse: CommandResult<
      ContinueCommandResponse,
      BitcoinAppErrorCodes
    > = fromResult;
    const interpreter = new ClientCommandInterpreter();

    const commandHandlersContext: ClientCommandContext = {
      dataStore,
      queue: [],
      yieldedResults: [],
    };

    while (
      this.isApduResponse(currentResponse) &&
      CommandUtils.isContinueResponse(currentResponse.data)
    ) {
      currentResponse = await interpreter
        .getClientCommandPayload(
          currentResponse.data.data,
          commandHandlersContext,
        )
        .caseOf({
          Left: (error) =>
            Promise.resolve(
              CommandResultFactory({
                error: new UnknownDeviceExchangeError(error),
              }),
            ),
          Right: (payload) =>
            this._api.sendCommand(
              new ContinueCommand({
                payload,
              }),
            ),
        });
    }
    return currentResponse;
  }
  private isApduResponse = (
    response: CommandResult<ContinueCommandResponse, BitcoinAppErrorCodes>,
  ): response is CommandSuccessResult<ApduResponse> => {
    return (
      isSuccessCommandResult(response) &&
      typeof response.data === "object" &&
      response.data !== null &&
      "statusCode" in response.data &&
      "data" in response.data
    );
  };
}
