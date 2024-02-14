import { SdkError } from "@root/src/api/Error";

import { Log, LogContext, LogData, LogMessage } from "./Log";

export class LogBuilder {
  static build(
    context: LogContext = {},
    data: LogData = {},
    ...messages: LogMessage[]
  ) {
    return new Log({ context, data, messages });
  }

  static buildWithTimestamp(
    context: LogContext = {},
    data: LogData = {},
    timestamp: number,
    ...messages: LogMessage[]
  ) {
    return new Log({ context, data, messages, timestamp });
  }

  static buildFromError(
    error: SdkError | Error,
    context: LogContext = { type: "error" },
    data: LogData = {},
    timestamp?: number,
  ) {
    const isSdkError = "_tag" in error;
    const message = isSdkError
      ? error.originalError
        ? error.originalError.message
        : error._tag
      : error.message;

    return new Log({
      context: {
        ...context,
        type: "error",
        tag: isSdkError ? error._tag : undefined,
      },
      data: {
        ...data,
        error,
      },
      messages: [message],
      timestamp,
    });
  }
}
