import React from "react";
import { Flex, Icons, Tooltip } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { type LoggerOptions, LoggerOptionsView } from "./LoggerOptions";

const ButtonContainer = styled.div`
  opacity: 0.65;
  &:hover {
    opacity: 1;
  }
`;

export const LoggerToolbar: React.FC<{
  clearLogs: () => void;
  downloadLogs: () => void;
  options: LoggerOptions;
  setOptions: (options: LoggerOptions) => void;
  uniqueTags: Set<string>;
}> = ({ clearLogs, downloadLogs, options, setOptions, uniqueTags }) => (
  <Flex flexDirection="row" columnGap={5}>
    <ButtonContainer onClick={clearLogs}>
      <Icons.DeleteStop size="S" />
    </ButtonContainer>
    <Tooltip
      trigger="click"
      placement="bottom"
      interactive
      content={
        <LoggerOptionsView
          options={options}
          setOptions={setOptions}
          uniqueTags={uniqueTags}
        />
      }
    >
      <ButtonContainer>
        <Icons.Settings size="S" />
      </ButtonContainer>
    </Tooltip>
    <ButtonContainer onClick={downloadLogs}>
      <Icons.Download size="S" />
    </ButtonContainer>
  </Flex>
);
