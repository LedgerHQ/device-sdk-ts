import React from "react";
import { Flex } from "@ledgerhq/react-ui";
import { Typography } from "antd";
import styled from "styled-components";

import { type LogData } from "./types";

export type LoggerOptions = {
  activeLevels: Record<LogData["verbosity"], boolean>;
  showTimestamp: boolean;
  showTag: boolean;
  includeTags: Set<string>;
  filterText: string;
};

type LoggerProps = {
  options: LoggerOptions;
  setOptions: (options: LoggerOptions) => void;
  uniqueTags: Set<string>;
};

export const defaultLoggerOptions: LoggerOptions = {
  activeLevels: {
    debug: true,
    info: true,
    warning: true,
    error: true,
    fatal: true,
  },
  showTimestamp: true,
  showTag: true,
  includeTags: new Set(),
  filterText: "",
};

const ParamContainer = styled(Flex).attrs({
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
})``;

const ParamTitle = styled(Typography.Title).attrs({
  level: 5,
})`
  margin-bottom: 20px;
`;

const OptionsContainer = styled(Flex).attrs({
  columnGap: 4,
  flexDirection: "row",
  flexWrap: "wrap",
  flexGrow: 1,
  overflow: "scroll",
})``;

const Input = styled.input`
  margin-right: 4px;
`;

export const LoggerOptionsView: React.FC<LoggerProps> = ({
  options,
  setOptions,
  uniqueTags,
}) => {
  return (
    <Flex flexDirection="column" borderRadius={8} padding={5} rowGap={5}>
      <ParamContainer>
        <ParamTitle style={{ color: "white", whiteSpace: "nowrap" }}>
          Log levels
        </ParamTitle>
        <OptionsContainer>
          {/** checkbox to select all / unselect all verbosity*/}
          <label>
            <Input
              type="checkbox"
              checked={Object.values(options.activeLevels).every(Boolean)}
              onChange={(e) => {
                const newActiveLevels = Object.fromEntries(
                  Object.keys(options.activeLevels).map((level) => [
                    level,
                    e.target.checked,
                  ]),
                );
                // setOptions({ ...options, activeLevels: newActiveLevels });
                setOptions({
                  ...options,
                  activeLevels:
                    newActiveLevels as LoggerOptions["activeLevels"],
                });
              }}
            />
            All
          </label>
          {["debug", "info", "warning", "error", "fatal"].map((level) => (
            <label key={level}>
              <Input
                type="checkbox"
                checked={options.activeLevels[level as LogData["verbosity"]]}
                onChange={(e) => {
                  setOptions({
                    ...options,
                    activeLevels: {
                      ...options.activeLevels,
                      [level as LogData["verbosity"]]: e.target.checked,
                    },
                  });
                }}
              />
              {level}
            </label>
          ))}
        </OptionsContainer>
      </ParamContainer>
      {/* <ParamContainer>
        <ParamTitle>Columns</ParamTitle>
        <OptionsContainer>
          <label>
            <Input
              type="checkbox"
              checked={options.showTimestamp}
              onChange={(e) => {
                setOptions({ ...options, showTimestamp: e.target.checked });
              }}
            />
            Timestamp
          </label>
          <label>
            <Input
              type="checkbox"
              checked={options.showTag}
              onChange={(e) => {
                setOptions({ ...options, showTag: e.target.checked });
              }}
            />
            Tag
          </label>
        </OptionsContainer>
      </ParamContainer> */}
      <ParamContainer>
        <ParamTitle style={{ color: "white", whiteSpace: "nowrap" }}>
          Tags
        </ParamTitle>
        <OptionsContainer>
          <label>
            <Input
              type="checkbox"
              checked={uniqueTags.size === options.includeTags.size}
              onChange={(e) => {
                if (e.target.checked) {
                  uniqueTags.forEach((tag) => options.includeTags.add(tag));
                } else {
                  options.includeTags.clear();
                }
                setOptions({ ...options });
              }}
            />
            All
          </label>
          {Array.from(uniqueTags).map((tag) => (
            <label key={tag}>
              <Input
                type="checkbox"
                checked={options.includeTags.has(tag)}
                onChange={(e) => {
                  if (e.target.checked) {
                    options.includeTags.add(tag);
                  } else {
                    options.includeTags.delete(tag);
                  }
                  setOptions({ ...options });
                }}
              />
              {tag}
            </label>
          ))}
        </OptionsContainer>
      </ParamContainer>
    </Flex>
  );
};
