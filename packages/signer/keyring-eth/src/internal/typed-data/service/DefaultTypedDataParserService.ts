import { injectable } from "inversify";
import { Either } from "purify-ts";

import { TypedData } from "@api/model/TypedData";
import { TypedDataValue } from "@internal/typed-data/model/Types";

import { TypedDataParser } from "./TypedDataParser";
import { TypedDataParserService } from "./TypedDataParserService";

@injectable()
export class DefaultTypedDataParserService implements TypedDataParserService {
  parse(data: TypedData): Either<Error, Array<TypedDataValue>> {
    const parser = new TypedDataParser(data.types);
    return parser.parse(data.primaryType, data.message);
  }
}
