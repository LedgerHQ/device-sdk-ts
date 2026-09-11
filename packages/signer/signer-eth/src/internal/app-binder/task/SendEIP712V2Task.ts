import {
  bufferToHexaString,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { SendEIP712SchemaCommand } from "@internal/app-binder/command/SendEIP712SchemaCommand";
import { SendEIP712ValuesCommand } from "@internal/app-binder/command/SendEIP712ValuesCommand";
import {
  SignEIP712Command,
  SignEIP712Implementation,
} from "@internal/app-binder/command/SignEIP712Command";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";
import { buildEip712V2Schema } from "@internal/typed-data/service/v2/Eip712V2SchemaBuilder";
import { buildEip712V2Values } from "@internal/typed-data/service/v2/Eip712V2ValuesBuilder";

import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

export type SendEIP712V2TaskArgs = {
  derivationPath: string;
  data: TypedData;
  parser: TypedDataParserService;
};

/**
 * Signs a typed message through the EIP-712 V2 protocol, raw: the schema, then the
 * values, then a bare sign command.
 *
 * There are no field descriptors yet, so every value is displayed unformatted and the
 * device refuses the review unless blind signing is enabled in its settings.
 *
 * The schema call is what opens the flow and a successful signature consumes the message,
 * so this is one complete exchange per signing session: nothing may be interleaved
 * between the three commands.
 */
export class SendEIP712V2Task {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendEIP712V2TaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, EthErrorCodes>> {
    const { data, derivationPath, parser } = this.args;

    // The parser is the source of the struct definitions rather than the raw types
    // dictionary: it resolves each declared type and appends the EIP712Domain struct when
    // the message omits it, which the app matches by name.
    const payloads = parser.parse(data).chain(({ types }) =>
      buildEip712V2Schema(types).chain((schema) =>
        buildEip712V2Values({
          types,
          primaryType: data.primaryType,
          derivationPath,
          domain: data.domain as Record<string, unknown>,
          message: data.message,
        }).map((values) => ({ schema, values })),
      ),
    );

    return payloads.caseOf<Promise<CommandResult<Signature, EthErrorCodes>>>({
      Left: (error) =>
        Promise.resolve(
          CommandResultFactory({
            error: new InvalidStatusWordError(
              `Failed to encode the EIP-712 V2 payloads: ${error.message}`,
            ),
          }),
        ),
      Right: ({ schema, values }) => this.send(schema, values),
    });
  }

  private async send(
    schema: Uint8Array,
    values: Uint8Array,
  ): Promise<CommandResult<Signature, EthErrorCodes>> {
    const schemaResult = await new SendPayloadInChunksTask(this.api, {
      payload: bufferToHexaString(schema),
      commandFactory: (args) =>
        new SendEIP712SchemaCommand({
          data: args.chunkedData,
          isFirstChunk: args.isFirstChunk,
        }),
    }).run();
    if (!isSuccessCommandResult(schemaResult)) {
      return schemaResult;
    }

    const valuesResult = await new SendPayloadInChunksTask(this.api, {
      payload: bufferToHexaString(values),
      commandFactory: (args) =>
        new SendEIP712ValuesCommand({
          data: args.chunkedData,
          isFirstChunk: args.isFirstChunk,
        }),
    }).run();
    if (!isSuccessCommandResult(valuesResult)) {
      return valuesResult;
    }

    return this.api.sendCommand(
      new SignEIP712Command({
        implementation: SignEIP712Implementation.V2,
      }),
    );
  }
}
