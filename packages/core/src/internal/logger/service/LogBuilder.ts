import { SdkError } from "@root/src/api/Error";

import { Log, LogContext, LogData, LogLevel, LogMessages } from "./Log";

export class LogBuilder {
  static build(
    context: LogContext = {},
    data: LogData = {},
    ...messages: LogMessages
  ) {
    return new Log({ context, data, messages });
  }

  static buildFromError(
    error: SdkError | Error,
    context: LogContext = { type: "error" },
    data: LogData = {},
  ) {
    const isSdkError = "_tag" in error;

    return new Log({
      level: LogLevel.Error,
      context: {
        ...context,
        type: "error",
        tag: isSdkError ? error._tag : undefined,
      },
      data: {
        ...data,
        error,
      },
      messages: isSdkError
        ? error.originalError
          ? [error.originalError.message]
          : [error._tag]
        : [error.message],
    });
  }
}
