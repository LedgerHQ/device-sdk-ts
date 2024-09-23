import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type CommandErrorResult,
  CommandResult,
  CommandResultFactory,
  HexaStringEncodeError,
  hexaStringToBuffer,
  type InternalApi,
  isSuccessCommandResult,
  type SdkError,
} from "@ledgerhq/device-management-kit";
import { Just, Maybe, Nothing } from "purify-ts";

import {
  PAYLOAD_LENGTH_BYTES,
  ProvideDomainNameCommand,
} from "@internal/app-binder/command/ProvideDomainNameCommand";
import {
  ProvideNFTInformationCommand,
  type ProvideNFTInformationCommandErrorCodes,
} from "@internal/app-binder/command/ProvideNFTInformationCommand";
import {
  ProvideTokenInformationCommand,
  ProvideTokenInformationCommandResponse,
} from "@internal/app-binder/command/ProvideTokenInformationCommand";
import {
  SetExternalPluginCommand,
  type SetExternalPluginCommandErrorCodes,
} from "@internal/app-binder/command/SetExternalPluginCommand";
import {
  SetPluginCommand,
  type SetPluginCommandErrorCodes,
} from "@internal/app-binder/command/SetPluginCommand";

export type ProvideTransactionContextTaskArgs = {
  /**
   * The valid clear sign contexts offerred by the `BuildTrancationContextTask`.
   */
  clearSignContexts: ClearSignContextSuccess[];
};

/**
 * Temporary error type to be used in the `ProvideTransactionContextTask` in order to not forget to handle the error cases.
 */
export class ProvideTransactionContextTaskError implements SdkError {
  readonly _tag = "ProvideTransactionContextTaskError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(
      message ?? "Unknow error in ProvideTransactionContextTaskError",
    );
  }
}

export type ProvideTransactionContextTaskErrorCodes =
  | void
  | SetExternalPluginCommandErrorCodes
  | SetPluginCommandErrorCodes
  | ProvideNFTInformationCommandErrorCodes;

/**
 * This task is responsible for providing the transaction context to the device.
 * It will send the 5 necessary commands:
 * - `SetPluginCommand` (single command)
 * - `SetExternalPluginCommand` (single command)
 * - `ProvideNFTInformationCommand` (single command)
 * - `ProvideTokenInformationCommand` (single command)
 * - `ProvideDomainNameCommand` (__mulpitle commands__)
 *
 * The method `provideDomainNameTask` is dedicated to send the multiple `ProvideDomainNameCommand`.
 */
export class ProvideTransactionContextTask {
  constructor(
    private api: InternalApi,
    private args: ProvideTransactionContextTaskArgs,
  ) {}

  async run(): Promise<
    Maybe<CommandErrorResult<ProvideTransactionContextTaskErrorCodes>>
  > {
    for (const context of this.args.clearSignContexts) {
      const res = await this.provideContext(context);
      if (!isSuccessCommandResult(res)) {
        return Just(res);
      }
    }
    return Nothing;
  }

  /**
   * This method will send a command according to the clear sign context type and return the command result if only one command
   * is sent, otherwise it will return the result of the `provideDomainNameTask`.
   *
   * @param context The clear sign context to provide.
   * @returns A promise that resolves when the command is sent or result of the `provideDomainNameTask`.
   */
  async provideContext({
    type,
    payload,
  }: ClearSignContextSuccess): Promise<
    CommandResult<
      void | ProvideTokenInformationCommandResponse,
      ProvideTransactionContextTaskErrorCodes
    >
  > {
    switch (type) {
      case ClearSignContextType.PLUGIN: {
        return await this.api.sendCommand(new SetPluginCommand({ payload }));
      }
      case ClearSignContextType.EXTERNAL_PLUGIN: {
        return await this.api.sendCommand(
          new SetExternalPluginCommand({ payload }),
        );
      }
      case ClearSignContextType.NFT: {
        return await this.api.sendCommand(
          new ProvideNFTInformationCommand({ payload }),
        );
      }
      case ClearSignContextType.TOKEN: {
        return await this.api.sendCommand(
          new ProvideTokenInformationCommand({ payload }),
        );
      }
      case ClearSignContextType.DOMAIN_NAME: {
        return await this.provideDomainNameTask(payload);
      }
      default: {
        const uncoveredType: never = type;
        throw new ProvideTransactionContextTaskError(
          `The context type [${uncoveredType}] is not covered`,
        );
      }
    }
  }

  /**
   * This method is responsible for chunking the domain name if necessary and sending `ProvideDomainNameCommand` to the device.
   * It will return the result of the last command sent if all the commands are successful, otherwise it will return the first
   * error result encountered.
   *
   * @param domainName Hexa representation of the domain name.
   * @returns A promise that resolves when the command is sent.
   */
  async provideDomainNameTask(
    domainName: string,
  ): Promise<CommandResult<void>> {
    const buffer = hexaStringToBuffer(domainName);

    if (buffer === null || buffer.length === 0) {
      throw new HexaStringEncodeError("provideDomainNameTask");
    }

    const data = new ByteArrayBuilder(buffer.length + PAYLOAD_LENGTH_BYTES)
      .add16BitUIntToData(buffer.length)
      .addBufferToData(buffer)
      .build();

    let result = CommandResultFactory<void, void>({ data: undefined });

    for (let i = 0; i < data.length; i += APDU_MAX_PAYLOAD) {
      result = await this.api.sendCommand(
        new ProvideDomainNameCommand({
          data: data.slice(i, i + APDU_MAX_PAYLOAD),
          isFirstChunk: i === 0,
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    return result;
  }
}
