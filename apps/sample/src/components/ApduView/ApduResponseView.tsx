import React from "react";
import { type ApduResponse } from "@ledgerhq/device-management-kit";
import { Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { CopyableApdu, CopyableApduResponse } from "./CopyableApdu";

export type ApduHistoryItem = {
  id: number;
  date: Date;
  rawApduSent: Uint8Array;
  response: ApduResponse;
};

const ApduRow = styled(Flex).attrs({
  flexDirection: "row",
  alignItems: "center",
  columnGap: 2,
})`
  font-family: monospace;
`;

const ApduDirection = styled(Text).attrs({
  variant: "body",
  color: "neutral.c70",
})`
  min-width: 24px;
`;

export const ApduResponseView: React.FC<{
  item: ApduHistoryItem;
  isLatest: boolean;
}> = ({ item, isLatest }) => {
  return (
    <Flex
      flexDirection="column"
      rowGap={2}
      alignItems="flex-start"
      bg={isLatest ? "neutral.c40" : "transparent"}
      p={3}
      borderRadius={2}
      flex={1}
    >
      <Text
        variant="small"
        color="neutral.c60"
        fontWeight={isLatest ? "medium" : "regular"}
      >
        #{item.id} - {item.date.toLocaleTimeString()}
      </Text>
      <Flex flexDirection="column" rowGap={2} width="100%">
        <ApduRow>
          <ApduDirection>{"=>"}</ApduDirection>
          <CopyableApdu rawApdu={item.rawApduSent} />
        </ApduRow>
        <ApduRow>
          <ApduDirection>{"<="}</ApduDirection>
          <CopyableApduResponse response={item.response} />
        </ApduRow>
      </Flex>
    </Flex>
  );
};
