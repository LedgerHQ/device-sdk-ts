import { injectable } from "inversify";
import { Either } from "purify-ts";

import { TypedData } from "@api/model/TypedData";

import { TypedDataParser } from "./TypedDataParser";
import {
  ParsedTypedData,
  TypedDataParserService,
} from "./TypedDataParserService";

@injectable()
export class DefaultTypedDataParserService implements TypedDataParserService {
  parse(data: TypedData): Either<Error, ParsedTypedData> {
    const parser = new TypedDataParser(data.types, data.domain);
    const types = parser.getStructDefinitions();
    const domainResult = parser.parse(
      "EIP712Domain",
      data.domain as Record<string, unknown>,
    );
    const messageResult = parser.parse(data.primaryType, data.message);
    return domainResult.chain((domain) =>
      messageResult.map((message) => ({
        types,
        domain,
        message,
      })),
    );
  }
}
