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
  private readonly _context: ClientCommandContext;

  constructor(
    private readonly _api: InternalApi,
    dataStore: DataStore,
    private readonly _clientCommandInterpreter = new ClientCommandInterpreter(),
  ) {
    this._context = {
      dataStore,
      queue: [],
      yieldedResults: [],
    };
  }

  async run(
    fromResult: CommandResult<ApduResponse, BtcErrorCodes>,
  ): Promise<CommandResult<ContinueCommandResponse, BtcErrorCodes>> {
    let currentResponse: CommandResult<ContinueCommandResponse, BtcErrorCodes> =
      fromResult;
    while (
      this.isApduResult(currentResponse) &&
      BtcCommandUtils.isContinueResponse(currentResponse.data)
    ) {
      currentResponse = await this._clientCommandInterpreter
        .getClientCommandPayload(currentResponse.data.data, this._context)
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

  getYieldedResults() {
    return this._context.yieldedResults;
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
