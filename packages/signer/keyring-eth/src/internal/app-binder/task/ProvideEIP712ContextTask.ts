import {
  type TypedDataClearSignContextSuccess,
  type TypedDataTokenIndex,
  VERIFYING_CONTRACT_TOKEN_INDEX,
} from "@ledgerhq/context-module";
import { InternalApi } from "@ledgerhq/device-sdk-core";
import { Maybe } from "purify-ts";

import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import {
  Eip712FilterType,
  SendEIP712FilteringCommand,
} from "@internal/app-binder/command/SendEIP712FilteringCommand";
import {
  SendEIP712StructDefinitionCommand,
  StructDefinitionCommand,
} from "@internal/app-binder/command/SendEIP712StructDefinitionCommand";
import { StructImplemType } from "@internal/app-binder/command/SendEIP712StructImplemCommand";
import { SendEIP712StructImplemTask } from "@internal/app-binder/task/SendEIP712StructImplemTask";
import {
  type FieldName,
  type FieldType,
  type StructName,
  TypedDataValue,
  TypedDataValueArray,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";

export type ProvideEIP712ContextTaskArgs = {
  types: Record<StructName, Record<FieldName, FieldType>>;
  domain: Array<TypedDataValue>;
  message: Array<TypedDataValue>;
  clearSignContext: Maybe<TypedDataClearSignContextSuccess>;
};

export class ProvideEIP712ContextTask {
  constructor(
    private api: InternalApi,
    private args: ProvideEIP712ContextTaskArgs,
  ) {}

  async run(): Promise<void> {
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
      await this.api.sendCommand(
        new SendEIP712StructDefinitionCommand({
          command: StructDefinitionCommand.Name,
          name: structName,
        }),
      );
      for (const [fieldName, fieldType] of Object.entries(fields)) {
        await this.api.sendCommand(
          new SendEIP712StructDefinitionCommand({
            command: StructDefinitionCommand.Field,
            name: fieldName,
            type: fieldType,
          }),
        );
      }
    }

    if (this.args.clearSignContext.isJust()) {
      // Activate the filtering, before sending domain and message implementations, as described here:
      // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#activation
      await this.api.sendCommand(
        new SendEIP712FilteringCommand({ type: Eip712FilterType.Activation }),
      );
    }

    // Send domain implementation values.
    for (const value of this.args.domain) {
      await this.getImplementationTask(value).run();
    }

    if (this.args.clearSignContext.isJust()) {
      // Send MessageInformation filter.
      // Should be sent between Domain and Message implementations, as described here:
      // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#message-info
      await this.api.sendCommand(
        new SendEIP712FilteringCommand({
          type: Eip712FilterType.MessageInfo,
          displayName:
            this.args.clearSignContext.extract().messageInfo.displayName,
          filtersCount:
            this.args.clearSignContext.extract().messageInfo.filtersCount,
          signature: this.args.clearSignContext.extract().messageInfo.signature,
        }),
      );
    }

    // Send message implementation values
    const tokensIndexes: Record<TypedDataTokenIndex, number> = {};
    for (const value of this.args.message) {
      // Provide the descriptors of tokens referenced by the message, if any.
      // Keep a map of all device indexes for those provided tokens.
      await this.provideTokenInformation(value, tokensIndexes);
      // If there is a filter, it should be sent just before the corresponding implementation:
      // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#amount-join-token
      await this.provideFiltering(value, tokensIndexes);
      // Provide message value implementation
      await this.getImplementationTask(value).run();
    }
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
    tokensIndexes: Record<TypedDataTokenIndex, number>,
  ): Promise<void> {
    if (this.args.clearSignContext.isJust()) {
      const filter = this.args.clearSignContext.extract().filters[value.path];
      // Tokens descriptors only needed when a tokenIndex is available in filter.
      // It should be sent to the device only 1 time so tokensIndexes has to be checked.
      if (
        filter !== undefined &&
        (filter.type === "amount" || filter.type === "token") &&
        tokensIndexes[filter.tokenIndex] === undefined
      ) {
        const descriptorIndex = filter.tokenIndex;
        const tokens = this.args.clearSignContext.extract().tokens;
        const token = tokens[descriptorIndex];
        if (token === undefined) {
          return;
        }

        let { tokenIndex: deviceIndex } = await this.api.sendCommand(
          new ProvideTokenInformationCommand({ payload: token }),
        );
        // The token corresponding to the Verifying Contract of message domain has a special index value, as described here:
        // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#amount-join-value
        if (Number(descriptorIndex) === VERIFYING_CONTRACT_TOKEN_INDEX) {
          deviceIndex = VERIFYING_CONTRACT_TOKEN_INDEX;
        }
        // Save the token index in the device slots. That index will be used by later filtering commands.
        tokensIndexes[Number(descriptorIndex)] = deviceIndex;
      }
    }
  }

  async provideFiltering(
    value: TypedDataValue,
    tokensIndexes: Record<TypedDataTokenIndex, number>,
  ): Promise<void> {
    if (this.args.clearSignContext.isJust()) {
      const filter = this.args.clearSignContext.extract().filters[value.path];
      if (
        filter === undefined ||
        ((filter.type === "amount" || filter.type === "token") &&
          tokensIndexes[filter.tokenIndex] === undefined)
      ) {
        return;
      }
      switch (filter.type) {
        case "datetime":
          await this.api.sendCommand(
            new SendEIP712FilteringCommand({
              type: Eip712FilterType.Datetime,
              displayName: filter.displayName,
              signature: filter.signature,
            }),
          );
          break;
        case "raw":
          await this.api.sendCommand(
            new SendEIP712FilteringCommand({
              type: Eip712FilterType.Raw,
              displayName: filter.displayName,
              signature: filter.signature,
            }),
          );
          break;
        case "token":
          await this.api.sendCommand(
            new SendEIP712FilteringCommand({
              type: Eip712FilterType.Token,
              tokenIndex: tokensIndexes[filter.tokenIndex]!,
              signature: filter.signature,
            }),
          );
          break;
        case "amount":
          await this.api.sendCommand(
            new SendEIP712FilteringCommand({
              type: Eip712FilterType.Amount,
              displayName: filter.displayName,
              tokenIndex: tokensIndexes[filter.tokenIndex]!,
              signature: filter.signature,
            }),
          );
          break;
      }
    }
  }
}