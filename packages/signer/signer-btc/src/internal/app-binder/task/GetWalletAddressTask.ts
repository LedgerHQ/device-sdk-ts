import {
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
  isCommandErrorCode,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type InternalApi } from "@ledgerhq/device-management-kit";

import { type ClientCommandContext } from "@internal/app-binder/command/client-command-handlers/ClientCommandHandlersTypes";
import { ContinueCommand } from "@internal/app-binder/command/ContinueCommand";
import {
  GetWalletAddressCommand,
  type GetWalletAddressCommandResponse,
} from "@internal/app-binder/command/GetWalletAddressCommand";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import {
  BitcoinAppCommandError,
  bitcoinAppErrors,
} from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { DataStore } from "@internal/data-store/model/DataStore";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { CommandUtils } from "@internal/utils/CommandUtils";
import { CommandUtils as BtcCommandUtils } from "@internal/utils/CommandUtils";
import { type Wallet } from "@internal/wallet/model/Wallet";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";

export type SendGetWalletAddressTaskArgs = {
  display: boolean;
  wallet: Wallet;
  change: boolean;
  addressIndex: number;
};

export class GetWalletAddressTask {
  constructor(
    private api: InternalApi,
    private args: SendGetWalletAddressTaskArgs,
  ) {}

  async run(): Promise<CommandResult<GetWalletAddressCommandResponse, void>> {
    const { display, wallet, change, addressIndex } = this.args;

    const dataStore = new DataStore();

    const interpreter = new ClientCommandInterpreter();

    const commandHandlersContext: ClientCommandContext = {
      dataStore,
      queue: [],
      yieldedResults: [],
    };

    const walletSerializer = new DefaultWalletSerializer(
      new Sha256HasherService(),
    );

    const walletId = walletSerializer.serialize(wallet);

    const getWalletAddressInitialResponse = await this.api.sendCommand(
      new GetWalletAddressCommand({
        display,
        walletId,
        walletHmac: wallet.hmac,
        change,
        addressIndex,
      }),
    );
    if (!isSuccessCommandResult(getWalletAddressInitialResponse)) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Invalid initial GET_WALLET_ADDRESS response",
        ),
      });
    }

    if (
      this.isGetWalletAddressCommandResponse(
        getWalletAddressInitialResponse.data,
      )
    ) {
      return CommandResultFactory({
        data: getWalletAddressInitialResponse.data,
      });
    }

    let currentResponse = getWalletAddressInitialResponse;
    while (
      this.isApduResponse(currentResponse.data) &&
      BtcCommandUtils.isContinueResponse(currentResponse.data)
    ) {
      const maybeCommandPayload = interpreter.getClientCommandPayload(
        currentResponse.data.data,
        commandHandlersContext,
      );

      if (maybeCommandPayload.isLeft()) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            maybeCommandPayload.extract().message,
          ),
        });
      }

      const payload = maybeCommandPayload.extract();
      if (payload instanceof Uint8Array) {
        const nextResponse = await this.api.sendCommand(
          new ContinueCommand(
            { payload },
            this.parseGetWalletAddressFinalResponse,
          ),
        );

        if (!isSuccessCommandResult(nextResponse)) {
          return CommandResultFactory({
            error: new InvalidStatusWordError(
              "Failed to get final wallet address response",
            ),
          });
        }

        if (this.isGetWalletAddressCommandResponse(nextResponse.data)) {
          return CommandResultFactory({
            data: nextResponse.data,
          });
        }

        currentResponse = nextResponse;
      }
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("Failed to retrieve wallet address."),
    });
  }

  private isGetWalletAddressCommandResponse(
    response: GetWalletAddressCommandResponse | ApduResponse,
  ): response is GetWalletAddressCommandResponse {
    return typeof response === "object" && "address" in response;
  }

  private isApduResponse(
    response: GetWalletAddressCommandResponse | ApduResponse,
  ): response is ApduResponse {
    return (
      typeof response === "object" &&
      "statusCode" in response &&
      "data" in response
    );
  }

  private parseGetWalletAddressFinalResponse(
    response: ApduResponse,
  ): CommandResult<GetWalletAddressCommandResponse | ApduResponse> {
    if (BtcCommandUtils.isContinueResponse(response)) {
      return CommandResultFactory({
        data: response,
      });
    }

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    const parser = new ApduParser(response);
    const errorCode = parser.encodeToHexaString(response.statusCode);
    if (isCommandErrorCode(errorCode, bitcoinAppErrors)) {
      return CommandResultFactory<GetWalletAddressCommandResponse>({
        error: new BitcoinAppCommandError({
          ...bitcoinAppErrors[errorCode],
          errorCode,
        }),
      });
    }

    if (response.data.length === 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to extract address from response",
        ),
      });
    }

    const address = parser.encodeToString(response.data);
    return CommandResultFactory({
      data: {
        address,
      },
    });
  }
}
