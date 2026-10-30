import React from "react";

import { LEVEL_TEXT } from "../logLevels";
import { hasPayload, PayloadPreview } from "../LogPayload";
import { type LogData } from "../types";

export const TimestampCell: React.FC<LogData> = ({ timestamp }) => {
  return (
    <p className="font-mono! body-3 whitespace-nowrap text-muted">
      {new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
        hour12: false,
      })}
    </p>
  );
};

export const TagCell: React.FC<LogData> = ({ tag }) => {
  return (
    <p className="truncate font-mono! body-3 text-muted" title={tag}>
      {tag}
    </p>
  );
};

export const VerbosityCell: React.FC<LogData> = ({ verbosity }) => {
  return (
    <span className={`font-mono! body-3 ${LEVEL_TEXT[verbosity]}`}>
      {verbosity}
    </span>
  );
};

export const MessageCell: React.FC<LogData> = ({ message, payload }) => {
  return (
    <p className="min-w-0 font-mono! body-3 break-all whitespace-pre-wrap text-base">
      {message}
      {hasPayload(payload) && (
        <>
          {" "}
          <span
            className="ml-8 font-mono! body-4 break-normal wrap-anywhere text-muted [&_*]:text-muted!"
            title="Click to show the payload"
          >
            <PayloadPreview payload={payload} />
          </span>
        </>
      )}
    </p>
  );
};
