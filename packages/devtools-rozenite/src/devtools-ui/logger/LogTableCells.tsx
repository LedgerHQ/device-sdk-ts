import { styled } from "styled-components";
import React from "react";
import { Inspector } from "react-inspector";
import { LoggerOptions } from "./LoggerOptions";
import { LogData } from "./types";

type Props = {
  log: LogData;
} & Pick<LoggerOptions, "showTimestamp" | "showTag">;

type Verbosity = LogData["verbosity"];

const mapVerbosityToTextProps = (
  verbosity: LogData["verbosity"]
): {
  color: string;
} => {
  const baseStyle = {
    whiteSpace: "nowrap",
    flexShrink: 0,
    alignSelf: "center",
  };
  switch (verbosity) {
    case "debug":
      return { ...baseStyle, color: "grey" };
    case "info":
      return { ...baseStyle, color: "black" };
    case "warning":
      return { ...baseStyle, color: "orange" };
    case "error":
      return { ...baseStyle, color: "red" };
    case "fatal":
      return { ...baseStyle, color: "red" };
    default:
      return { ...baseStyle, color: "grey" };
  }
};

export const LogText = styled.p<{ verbosity: Verbosity }>(({ verbosity }) => {
  return mapVerbosityToTextProps(verbosity);
});

export const TimestampCell: React.FC<LogData> = ({ timestamp, verbosity }) => {
  return (
    <div>
      <LogText style={{ fontSize: 10, paddingBottom: 2 }} verbosity={verbosity}>
        {timestamp.split("T")[1].split("Z")[0]}
      </LogText>
    </div>
  );
};

export const TagCell: React.FC<LogData> = ({ tag, verbosity }) => {
  return (
    <div>
      <LogText style={{ fontWeight: "bold", width: 190 }} verbosity={verbosity}>
        {tag}
      </LogText>
    </div>
  );
};

export const VerbosityCel: React.FC<LogData> = ({ verbosity }) => {
  return (
    <div>
      <LogText verbosity={verbosity}>{verbosity}</LogText>
    </div>
  );
};

export const MessageCell: React.FC<LogData> = ({ message, verbosity }) => {
  return (
    <div>
      <LogText verbosity={verbosity}>{message}</LogText>
    </div>
  );
};

export const PayloadCell: React.FC<LogData> = ({ payload }) => {
  return (
    <div>
      <Inspector
        table={false}
        data={typeof payload === "string" ? payload : { ...payload }}
        expandLevel={0}
      />
    </div>
  );
};
