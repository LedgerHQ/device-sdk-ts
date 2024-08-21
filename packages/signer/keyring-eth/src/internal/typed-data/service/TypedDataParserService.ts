import { Either } from "purify-ts";

import { TypedData } from "@api/model/TypedData";
import {
  FieldName,
  FieldType,
  StructName,
  TypedDataValue,
} from "@internal/typed-data/model/Types";

export interface ParsedTypedData {
  types: Record<StructName, Record<FieldName, FieldType>>;
  domain: Array<TypedDataValue>;
  message: Array<TypedDataValue>;
}

export interface TypedDataParserService {
  parse(message: TypedData): Either<Error, ParsedTypedData>;
}
