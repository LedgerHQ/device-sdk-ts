import { type Either } from "purify-ts";

import { type TypedData } from "@api/model/TypedData";
import {
  type FieldName,
  type FieldType,
  type StructName,
  type TypedDataValue,
} from "@internal/typed-data/model/Types";

export interface ParsedTypedData {
  types: Record<StructName, Record<FieldName, FieldType>>;
  domain: Array<TypedDataValue>;
  message: Array<TypedDataValue>;
}

export interface TypedDataParserService {
  parse(message: TypedData): Either<Error, ParsedTypedData>;
}
