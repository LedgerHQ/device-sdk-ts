import { Either } from "purify-ts";

import { TypedData } from "@api/model/TypedData";
import { TypedDataValue } from "@internal/typed-data/model/Types";

export interface TypedDataParserService {
  parse(message: TypedData): Either<Error, Array<TypedDataValue>>;
}
