export class ApiCallError {
  readonly _tag = "ApiCallError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class ParseResponseError {
  readonly _tag = "ParseResponseError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class JSONParseError {
  readonly _tag = "JSONParseError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export type RemoteConfigFailure =
  | ApiCallError
  | ParseResponseError
  | JSONParseError;

export class ReadFileError {
  readonly _tag = "ReadFileError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export type LocalConfigFailure = JSONParseError | ReadFileError;
