import {
  type ContextModule,
  type TypedDataClearSignContextSuccess,
  type TypedDataFilter,
  type TypedDataTokenIndex,
  VERIFYING_CONTRACT_TOKEN_INDEX,
} from "@ledgerhq/context-module";
import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import type {
  CommandResult,
  InternalApi,
} from "@ledgerhq/device-management-kit";
import {
  bufferToHexaString,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { Just, Maybe, Nothing } from "purify-ts";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import {
  Eip712FilterType,
  SendEIP712FilteringCommand,
} from "@internal/app-binder/command/SendEIP712FilteringCommand";
import {
  SendEIP712StructDefinitionCommand,
  StructDefinitionCommand,
} from "@internal/app-binder/command/SendEIP712StructDefinitionCommand";
import { StructImplemType } from "@internal/app-binder/command/SendEIP712StructImplemCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { SendEIP712StructImplemTask } from "@internal/app-binder/task/SendEIP712StructImplemTask";
import { TypedDataValueField } from "@internal/typed-data/model/Types";
import {
  type FieldName,
  type FieldType,
  type StructName,
  type TypedDataValue,
  TypedDataValueArray,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";

import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

type AllSuccessTypes = void | { tokenIndex: number };

export type ProvideEIP712ContextTaskReturnType = Promise<
  CommandResult<AllSuccessTypes, EthErrorCodes>
>;

export type ProvideEIP712ContextTaskArgs = {
  types: Record<StructName, Record<FieldName, FieldType>>;
  domain: Array<TypedDataValue>;
  message: Array<TypedDataValue>;
  clearSignContext: Maybe<TypedDataClearSignContextSuccess>;
  web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null;
};

const DEVICE_ASSETS_MAX = 5;

type DeviceAssetIndexes = {
  indexes: Record<TypedDataTokenIndex, number>;
  nextIndex: number;
};

export class ProvideEIP712ContextTask {
  private chainId: Maybe<number> = Nothing;

  constructor(
    private api: InternalApi,
    private contextModule: ContextModule,
    private args: ProvideEIP712ContextTaskArgs,
  ) {
    for (const domainValue of this.args.domain) {
      if (
        domainValue.path === "chainId" &&
        domainValue.value instanceof TypedDataValueField
      ) {
        const val = BigInt(bufferToHexaString(domainValue.value.data));
        if (val <= Number.MAX_SAFE_INTEGER) {
          this.chainId = Just(Number(val));
        }
        break;
      }
    }
  }

  async run(): ProvideEIP712ContextTaskReturnType {
    // Send message simulation first
    if (this.args.web3Check) {
      if (this.args.web3Check.certificate) {
        await this.api.sendCommand(
          new LoadCertificateCommand({
            keyUsage: this.args.web3Check.certificate.keyUsageNumber,
            certificate: this.args.web3Check.certificate.payload,
          }),
        );
      }
      await new SendPayloadInChunksTask(this.api, {
        payload: this.args.web3Check.payload,
        commandFactory: (args) =>
          new ProvideWeb3CheckCommand({
            payload: args.chunkedData,
            isFirstChunk: args.isFirstChunk,
          }),
      }).run();
    }

    const result: CommandResult<AllSuccessTypes, EthErrorCodes> =
      CommandResultFactory<AllSuccessTypes, EthErrorCodes>({ data: undefined });

    // Provide the structure definitions.
    // Should be sent before struct implementations, as described here:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#eip712-send-struct-definition
    // Note that those types are used to compute the schema hash, in the device and in ClearSignContexts, as described here:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#eip712-filtering
    // Therefore it should be normalized on both sides: sorted per keys
    const types = Object.entries(this.args.types).sort(([aKey], [bKey]) =>
      aKey.localeCompare(bKey),
    );
    for (const [structName, fields] of types) {
      const structNameResult = await this.api.sendCommand(
        new SendEIP712StructDefinitionCommand({
          command: StructDefinitionCommand.Name,
          name: structName,
        }),
      );
      if (!isSuccessCommandResult(structNameResult)) {
        return structNameResult;
      }

      for (const [fieldName, fieldType] of Object.entries(fields)) {
        const fieldResult = await this.api.sendCommand(
          new SendEIP712StructDefinitionCommand({
            command: StructDefinitionCommand.Field,
            name: fieldName,
            type: fieldType,
          }),
        );
        if (!isSuccessCommandResult(fieldResult)) {
          return fieldResult;
        }
      }
    }

    // possibly activate the filtering, before sending domain and message implementations, as described here:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#activation
    if (this.args.clearSignContext.isJust()) {
      const activationResult = await this.api.sendCommand(
        new SendEIP712FilteringCommand({ type: Eip712FilterType.Activation }),
      );
      if (!isSuccessCommandResult(activationResult)) {
        return activationResult;
      }
    }

    // send domain implementation values.
    for (const value of this.args.domain) {
      const domainImplTask = this.getImplementationTask(value);
      const domainImplResult = await domainImplTask.run();
      if (!isSuccessCommandResult(domainImplResult)) {
        return domainImplResult;
      }
    }

    // possibly send MessageInformation filter (between Domain and Message)
    // should be sent between Domain and Message implementations, as described here:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#message-info
    if (this.args.clearSignContext.isJust()) {
      const clearSignContext = this.args.clearSignContext.extract();
      const messageInfoFilterResult = await this.api.sendCommand(
        new SendEIP712FilteringCommand({
          type: Eip712FilterType.MessageInfo,
          displayName: clearSignContext.messageInfo.displayName,
          filtersCount: clearSignContext.messageInfo.filtersCount,
          signature: clearSignContext.messageInfo.signature,
        }),
      );
      if (!isSuccessCommandResult(messageInfoFilterResult)) {
        return messageInfoFilterResult;
      }
    }

    // send message implementation values
    const deviceIndexes: DeviceAssetIndexes = { indexes: {}, nextIndex: 0 };
    for (const value of this.args.message) {
      // 5.1 Provide token descriptors, if any
      // Keep a map of all device indexes for those provided tokens.
      const maybeTokenError = await this.provideTokenInformation(
        value,
        deviceIndexes,
      );
      if (maybeTokenError.isJust()) {
        return maybeTokenError.extract();
      }

      // Provide trusted name descriptors, if any
      const maybeNameError = await this.provideTrustedName(value);
      if (maybeNameError.isJust()) {
        return maybeNameError.extract();
      }

      // if there's a filter, send it
      // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#amount-join-token
      const maybeFilterResult = await this.filterValue(value, deviceIndexes);
      if (
        maybeFilterResult.isJust() &&
        !isSuccessCommandResult(maybeFilterResult.extract())
      ) {
        return maybeFilterResult.extract();
      }

      // provide message value implementation
      const messageImplTask = this.getImplementationTask(value);
      const messageImplResult = await messageImplTask.run();
      if (!isSuccessCommandResult(messageImplResult)) {
        return messageImplResult;
      }

      // if the value is an empty array, discard sub-filters since
      // there will be no according sub-values in the message
      if (
        this.args.clearSignContext.isJust() &&
        value.value instanceof TypedDataValueArray &&
        value.value.length === 0
      ) {
        const filters = Object.entries(
          this.args.clearSignContext.extract().filters,
        );
        const discardedFilters = filters
          .filter(([path]) => path.startsWith(`${value.path}.[]`))
          .map(([, filter]) => filter);
        for (const filter of discardedFilters) {
          const discardedPathResult = await this.api.sendCommand(
            new SendEIP712FilteringCommand({
              type: Eip712FilterType.DiscardedPath,
              path: filter.path,
            }),
          );
          if (!isSuccessCommandResult(discardedPathResult)) {
            return discardedPathResult;
          }

          const provideFilteringResult = await this.provideFiltering(
            filter,
            deviceIndexes,
            true,
          );
          if (!isSuccessCommandResult(provideFilteringResult)) {
            return provideFilteringResult;
          }
        }
      }
    }

    return result;
  }

  getImplementationTask(value: TypedDataValue): SendEIP712StructImplemTask {
    if (value.value instanceof TypedDataValueRoot) {
      return new SendEIP712StructImplemTask(this.api, {
        type: StructImplemType.ROOT,
        value: value.value.root,
      });
    } else if (value.value instanceof TypedDataValueArray) {
      return new SendEIP712StructImplemTask(this.api, {
        type: StructImplemType.ARRAY,
        value: value.value.length,
      });
    } else {
      return new SendEIP712StructImplemTask(this.api, {
        type: StructImplemType.FIELD,
        value: value.value.data,
      });
    }
  }

  async provideTokenInformation(
    value: TypedDataValue,
    deviceIndexes: DeviceAssetIndexes,
  ): Promise<Maybe<CommandResult<AllSuccessTypes, EthErrorCodes>>> {
    if (this.args.clearSignContext.isJust()) {
      const filter = this.args.clearSignContext.extract().filters[value.path];
      // tokens descriptors only needed when a tokenIndex is available in filter.
      // it should be sent to the device only 1 time so deviceIndexes has to be checked.
      if (
        filter !== undefined &&
        (filter.type === "amount" || filter.type === "token") &&
        deviceIndexes.indexes[filter.tokenIndex] === undefined
      ) {
        const descriptorIndex = filter.tokenIndex;
        const tokens = this.args.clearSignContext.extract().tokens;
        const token = tokens[descriptorIndex];
        if (token === undefined) {
          return Nothing;
        }

        const provideTokenInfoResult = await this.api.sendCommand(
          new ProvideTokenInformationCommand({ payload: token }),
        );
        if (!isSuccessCommandResult(provideTokenInfoResult)) {
          return Maybe.of(provideTokenInfoResult);
        }
        let { tokenIndex: deviceIndex } = provideTokenInfoResult.data;
        deviceIndexes.nextIndex = (deviceIndex + 1) % DEVICE_ASSETS_MAX;

        // the token corresponding to the Verifying Contract of message domain has a special index value, as described here:
        // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#amount-join-value
        if (Number(descriptorIndex) === VERIFYING_CONTRACT_TOKEN_INDEX) {
          deviceIndex = VERIFYING_CONTRACT_TOKEN_INDEX;
        }

        deviceIndexes.indexes[Number(descriptorIndex)] = deviceIndex;
      }
    }
    return Nothing;
  }

  private async provideTrustedName(
    value: TypedDataValue,
  ): Promise<Maybe<CommandResult<AllSuccessTypes, EthErrorCodes>>> {
    if (this.args.clearSignContext.isJust() && this.chainId.isJust()) {
      const context = this.args.clearSignContext.extract();
      const filter = context.filters[value.path];
      const address = context.trustedNamesAddresses[value.path];
      if (
        filter !== undefined &&
        filter.type === "trusted-name" &&
        address !== undefined
      ) {
        const getChallengeResult = await this.api.sendCommand(
          new GetChallengeCommand(),
        );
        if (!isSuccessCommandResult(getChallengeResult)) {
          return Just(getChallengeResult);
        }

        const context = await this.contextModule.getContext({
          type: ClearSignContextType.TRUSTED_NAME,
          chainId: this.chainId.extract(),
          address,
          challenge: getChallengeResult.data.challenge,
          types: filter.types,
          sources: filter.sources,
        });
        if (context.type === ClearSignContextType.TRUSTED_NAME) {
          if (context.certificate) {
            await this.api.sendCommand(
              new LoadCertificateCommand({
                keyUsage: context.certificate.keyUsageNumber,
                certificate: context.certificate.payload,
              }),
            );
          }
          const provideNameResult = await new SendPayloadInChunksTask(
            this.api,
            {
              payload: context.payload,
              commandFactory: (args) =>
                new ProvideTrustedNameCommand({
                  data: args.chunkedData,
                  isFirstChunk: args.isFirstChunk,
                }),
            },
          ).run();
          if (!isSuccessCommandResult(provideNameResult)) {
            return Just(provideNameResult);
          }
        }
      }
    }
    return Nothing;
  }

  async filterValue(
    value: TypedDataValue,
    deviceIndexes: DeviceAssetIndexes,
  ): Promise<Maybe<CommandResult<AllSuccessTypes, EthErrorCodes>>> {
    if (this.args.clearSignContext.isJust()) {
      const filter = this.args.clearSignContext.extract().filters[value.path];
      if (filter === undefined) {
        return Nothing;
      }
      // provide the filter
      const filteringResult = await this.provideFiltering(
        filter,
        deviceIndexes,
        false,
      );
      return Maybe.of(filteringResult);
    }
    return Nothing;
  }

  async provideFiltering(
    filter: TypedDataFilter,
    deviceIndexes: DeviceAssetIndexes,
    discarded: boolean,
  ): Promise<CommandResult<AllSuccessTypes, EthErrorCodes>> {
    switch (filter.type) {
      case "trusted-name":
        return await this.api.sendCommand(
          new SendEIP712FilteringCommand({
            type: Eip712FilterType.TrustedName,
            discarded,
            displayName: filter.displayName,
            typesAndSourcesPayload: filter.typesAndSourcesPayload,
            signature: filter.signature,
          }),
        );
      case "datetime":
        return await this.api.sendCommand(
          new SendEIP712FilteringCommand({
            type: Eip712FilterType.Datetime,
            discarded,
            displayName: filter.displayName,
            signature: filter.signature,
          }),
        );
      case "raw":
        return await this.api.sendCommand(
          new SendEIP712FilteringCommand({
            type: Eip712FilterType.Raw,
            discarded,
            displayName: filter.displayName,
            signature: filter.signature,
          }),
        );
      case "token":
        this.sanitizeDeviceIndex(filter.tokenIndex, deviceIndexes);
        return await this.api.sendCommand(
          new SendEIP712FilteringCommand({
            type: Eip712FilterType.Token,
            discarded,
            tokenIndex: deviceIndexes.indexes[filter.tokenIndex]!,
            signature: filter.signature,
          }),
        );
      case "amount":
        this.sanitizeDeviceIndex(filter.tokenIndex, deviceIndexes);
        return await this.api.sendCommand(
          new SendEIP712FilteringCommand({
            type: Eip712FilterType.Amount,
            discarded,
            displayName: filter.displayName,
            tokenIndex: deviceIndexes.indexes[filter.tokenIndex]!,
            signature: filter.signature,
          }),
        );
      default:
        return CommandResultFactory<AllSuccessTypes, EthErrorCodes>({
          error: new InvalidStatusWordError(
            "ProvideEIP712ContextTask/provideFiltering - Unhandled filter type",
          ),
        });
    }
  }

  private sanitizeDeviceIndex(
    descriptorIndex: number,
    deviceIndexes: DeviceAssetIndexes,
  ) {
    // If a token is missing, the device will replace it with a placeholder and use the next available index
    if (deviceIndexes.indexes[descriptorIndex] === undefined) {
      deviceIndexes.indexes[descriptorIndex] = deviceIndexes.nextIndex;
      deviceIndexes.nextIndex =
        (deviceIndexes.nextIndex + 1) % DEVICE_ASSETS_MAX;
    }
  }
}
