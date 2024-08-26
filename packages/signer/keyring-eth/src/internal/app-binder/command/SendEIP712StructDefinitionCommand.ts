// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#eip712-send-struct-definition
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduResponse,
  type Command,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-sdk-core";
import { Just, Maybe, Nothing } from "purify-ts";

import {
  ArrayType,
  type FieldName,
  type FieldType,
  PrimitiveType,
  StructType,
} from "@internal/typed-data/model/Types";

export enum StructDefinitionCommand {
  Name = 0,
  Field = 255,
}

export type SendEIP712StructDefinitionCommandArgs =
  | { command: StructDefinitionCommand.Name; name: string }
  | {
      command: StructDefinitionCommand.Field;
      name: FieldName;
      type: FieldType;
    };

enum ArraySize {
  Dynamic,
  Fixed,
}

enum Type {
  Custom,
  Int,
  Uint,
  Address,
  Bool,
  String,
  FixedSizedBytes,
  DynamicSizedBytes,
}

export class SendEIP712StructDefinitionCommand
  implements Command<void, SendEIP712StructDefinitionCommandArgs>
{
  constructor(private args: SendEIP712StructDefinitionCommandArgs) {}

  getApdu(): Apdu {
    const SendEIP712StructDefinitionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x1a,
      p1: 0x00,
      p2: this.args.command,
    };

    // Struct name
    if (this.args.command === StructDefinitionCommand.Name) {
      return new ApduBuilder(SendEIP712StructDefinitionArgs)
        .addAsciiStringToData(this.args.name)
        .build();
    }

    // Struct field
    const builder = new ApduBuilder(SendEIP712StructDefinitionArgs);

    const typeDesc = this.constructTypeDescByte(this.args.type);

    // Add type descriptor
    builder.add8BitUIntToData(typeDesc);

    // Add struct name if this is a custom type
    this.getTypeCustomName(this.args.type).ifJust((customName) => {
      builder.encodeInLVFromAscii(customName);
    });

    // Add type size, if applicable
    this.getTypeSize(this.args.type).ifJust((size) => {
      builder.add8BitUIntToData(size);
    });

    // Add array levels, if it is an array
    if (this.args.type instanceof ArrayType) {
      builder.add8BitUIntToData(this.args.type.levels.length);
      for (const level of this.args.type.levels) {
        level.caseOf({
          Just: (l) => {
            builder.add8BitUIntToData(ArraySize.Fixed).add8BitUIntToData(l);
          },
          Nothing: () => {
            builder.add8BitUIntToData(ArraySize.Dynamic);
          },
        });
      }
    }

    // Add field name
    return builder.encodeInLVFromAscii(this.args.name).build();
  }

  parseResponse(response: ApduResponse): CommandResult<void> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    return CommandResultFactory({ data: undefined });
  }

  private constructTypeDescByte(type: FieldType): number {
    const isArrayBit = type instanceof ArrayType ? 1 : 0;
    const hasTypeSize = this.getTypeSize(type).isJust() ? 1 : 0;
    const typeBits = this.getType(type);

    // Combine the bits using bitwise operations
    const combinedBits = (isArrayBit << 7) | (hasTypeSize << 6) | typeBits;
    return combinedBits;
  }

  private getTypeSize(type: FieldType): Maybe<number> {
    if (type instanceof ArrayType) {
      return this.getTypeSize(type.rootType);
    }
    return type instanceof PrimitiveType ? type.size : Nothing;
  }

  private getTypeCustomName(type: FieldType): Maybe<string> {
    if (type instanceof ArrayType) {
      return this.getTypeCustomName(type.rootType);
    }
    return type instanceof StructType ? Just(type.typeName) : Nothing;
  }

  private getType(type: FieldType): Type {
    if (type instanceof ArrayType) {
      return this.getType(type.rootType);
    } else if (type instanceof StructType) {
      return Type.Custom;
    }
    switch (type.name) {
      case "int":
        return Type.Int;
      case "uint":
        return Type.Uint;
      case "address":
        return Type.Address;
      case "bool":
        return Type.Bool;
      case "string":
        return Type.String;
      case "bytes":
        return type.size.isJust()
          ? Type.FixedSizedBytes
          : Type.DynamicSizedBytes;
    }
  }
}
