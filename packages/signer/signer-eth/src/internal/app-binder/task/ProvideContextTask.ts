import {
  ClearSignContextType,
  type EthereumClearSignContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  LoadCertificateCommand,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { ProvideEnumCommand } from "@internal/app-binder/command/ProvideEnumCommand";
import { ProvideGatedSigningCommand } from "@internal/app-binder/command/ProvideGatedSigningCommand";
import {
  NetworkConfigurationType,
  ProvideNetworkConfigurationCommand,
} from "@internal/app-binder/command/ProvideNetworkConfigurationCommand";
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideProxyInfoCommand } from "@internal/app-binder/command/ProvideProxyInfoCommand";
import {
  ProvideSafeAccountCommand,
  ProvideSafeAccountCommandType,
} from "@internal/app-binder/command/ProvideSafeAccountCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { SetExternalPluginCommand } from "@internal/app-binder/command/SetExternalPluginCommand";
import { SetPluginCommand } from "@internal/app-binder/command/SetPluginCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

import {
  SendPayloadInChunksTask,
  type SendPayloadInChunksTaskArgs,
} from "./SendPayloadInChunksTask";

export type ProvideContextTaskArgs = {
  /**
   * The clear sign context to provide.
   */
  context: EthereumClearSignContextSuccess;
  /**
   * Logger factory for creating loggers with custom tags.
   */
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export type ProvideContextTaskResult = CommandResult<unknown, EthErrorCodes>;

/**
 * This task is responsible for providing a single context to the device.
 */
export class ProvideContextTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private _api: InternalApi,
    private _args: ProvideContextTaskArgs,
    private _sendPayloadInChunksTaskFactory = (
      api: InternalApi,
      args: SendPayloadInChunksTaskArgs<unknown>,
    ) => new SendPayloadInChunksTask(api, args),
  ) {
    this._logger = _args.loggerFactory("ProvideContextTask");
  }

  async run(): Promise<ProvideContextTaskResult> {
    const { type, payload, certificate } = this._args.context;
    this._logger.debug("[run] Providing context", {
      data: {
        type,
        payloadLength: typeof payload === "string" ? payload.length : undefined,
        hasCertificate: !!certificate,
      },
    });

    // if a certificate is provided, we load it before sending the command
    if (certificate) {
      await this._api.sendCommand(
        new LoadCertificateCommand({
          keyUsage: certificate.keyUsageNumber,
          certificate: certificate.payload,
        }),
      );
    }

    // FUTURE: ClearSignContextType.CONTACT_EXTERNAL /
    // CONTACT_LEDGER_ACCOUNT branches will plug in here once Contacts is
    // unified into the ContextModule pipeline (see
    // SignerEth.signTransaction JSDoc). Until then, those decorations
    // are pushed out-of-band via EthAppBinder.provideContact /
    // provideLedgerAccount. Tracked: <TICKET-ID>.
    switch (type) {
      case ClearSignContextType.ETHEREUM_PLUGIN: {
        return await this._api.sendCommand(new SetPluginCommand({ payload }));
      }
      case ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN: {
        return await this._api.sendCommand(
          new SetExternalPluginCommand({ payload }),
        );
      }
      case ClearSignContextType.ETHEREUM_NFT: {
        return await this._api.sendCommand(
          new ProvideNFTInformationCommand({ payload }),
        );
      }
      case ClearSignContextType.ETHEREUM_TOKEN: {
        return await this._api.sendCommand(
          new ProvideTokenInformationCommand({ payload }),
        );
      }
      case ClearSignContextType.ETHEREUM_TRANSACTION_INFO: {
        const transactionInfoResult =
          await this._sendPayloadInChunksTaskFactory(this._api, {
            payload,
            commandFactory: (args) =>
              new ProvideTransactionInformationCommand({
                data: args.chunkedData,
                isFirstChunk: args.isFirstChunk,
              }),
          }).run();

        return transactionInfoResult;
      }
      case ClearSignContextType.ETHEREUM_TRUSTED_NAME: {
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideTrustedNameCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      }
      case ClearSignContextType.ETHEREUM_ENUM:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideEnumCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideTransactionFieldDescriptionCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.ETHEREUM_TRANSACTION_CHECK:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideWeb3CheckCommand({
              payload: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.ETHEREUM_PROXY_INFO:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideProxyInfoCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK:
        // Dynamic network configuration uses the existing ProvideNetworkConfiguration command
        // but is provided as part of the context flow
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideNetworkConfigurationCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
              configurationType: NetworkConfigurationType.CONFIGURATION,
            }),
        }).run();
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON: {
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideNetworkConfigurationCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
              configurationType: NetworkConfigurationType.ICON,
            }),
          withPayloadLength: false,
        }).run();
      }
      case ClearSignContextType.ETHEREUM_SAFE:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideSafeAccountCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
              type: ProvideSafeAccountCommandType.SAFE_DESCRIPTOR,
            }),
        }).run();
      case ClearSignContextType.ETHEREUM_SIGNER:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideSafeAccountCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
              type: ProvideSafeAccountCommandType.SIGNER_DESCRIPTOR,
            }),
        }).run();
      case ClearSignContextType.ETHEREUM_GATED_SIGNING:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideGatedSigningCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      default: {
        const uncoveredType: never = type;
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `The context type [${uncoveredType}] is not covered`,
          ),
        });
      }
    }
  }
}
