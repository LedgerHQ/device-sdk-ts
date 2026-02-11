import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  DYNAMIC_NETWORK_CONTEXT_TYPES,
  type DynamicNetworkContextInput,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type GetAddressCommandResponse } from "@api/app-binder/GetAddressCommandTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

import { ProvideContextTask } from "./ProvideContextTask";

export type SendGetAddressTaskArgs = {
  readonly contextModule: ContextModule;
  readonly derivationPath: string;
  readonly checkOnDevice: boolean;
  readonly returnChainCode: boolean;
  readonly chainId?: number;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

export class SendGetAddressTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SendGetAddressTaskArgs,
  ) {
    this._logger = _args.loggerFactory("SendGetAddressTask");
  }

  async run(): Promise<
    CommandResult<GetAddressCommandResponse, EthErrorCodes>
  > {
    const {
      contextModule,
      derivationPath,
      checkOnDevice,
      returnChainCode,
      chainId,
    } = this._args;

    const effectiveChainId =
      checkOnDevice && chainId !== undefined ? chainId : undefined;

    if (effectiveChainId !== undefined) {
      const deviceModelId = this._api.getDeviceModel().id;
      const dynamicNetworkInput: DynamicNetworkContextInput = {
        chainId: effectiveChainId,
        deviceModelId,
      };

      this._logger.debug("[run] Loading dynamic network context", {
        data: { chainId: effectiveChainId, deviceModelId },
      });

      const contexts = await contextModule.getContexts(
        dynamicNetworkInput,
        DYNAMIC_NETWORK_CONTEXT_TYPES,
      );

      const successContexts = contexts.filter(
        (c): c is ClearSignContextSuccess =>
          c.type !== ClearSignContextType.ERROR,
      );

      for (const context of successContexts) {
        const result = await new ProvideContextTask(this._api, {
          context,
          loggerFactory: this._args.loggerFactory,
        }).run();

        if (!isSuccessCommandResult(result)) {
          this._logger.debug(
            "[run] Ignoring context provision error, continuing to getAddress",
            {
              data: { contextType: context.type, error: result.error },
            },
          );
        }
      }
    }

    return this._api.sendCommand(
      new GetAddressCommand({
        derivationPath,
        checkOnDevice,
        returnChainCode,
        ...(effectiveChainId !== undefined && { chainId: effectiveChainId }),
      }),
    );
  }
}
