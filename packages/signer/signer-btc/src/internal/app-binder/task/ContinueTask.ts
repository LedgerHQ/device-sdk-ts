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
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";

export class ContinueTask {
  private readonly _clientCommandInterpreter: ClientCommandInterpreter;

  constructor(
    private readonly _api: InternalApi,
    clientCommandInterpreter?: ClientCommandInterpreter,
  ) {
    this._clientCommandInterpreter =
      clientCommandInterpreter || new ClientCommandInterpreter();
  }

  async run(
    dataStore: DataStore,
    fromResult: CommandResult<ApduResponse, BtcErrorCodes>,
  ): Promise<CommandResult<ContinueCommandResponse, BtcErrorCodes>> {
    let currentResponse: CommandResult<ContinueCommandResponse, BtcErrorCodes> =
      fromResult;
    const commandHandlersContext: ClientCommandContext = {
      dataStore,
      queue: [],
      yieldedResults: [],
    };

    while (
      this.isApduResult(currentResponse) &&
      BtcCommandUtils.isContinueResponse(currentResponse.data)
    ) {
      currentResponse = await this._clientCommandInterpreter
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
  private isApduResult = (
    response: CommandResult<ContinueCommandResponse, BtcErrorCodes>,
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
