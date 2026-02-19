import React from "react";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { SimpleTooltip } from "@/components/SimpleTooltip";

export const InputLabel = styled(Text).attrs({
  fontSize: "13px",
  alignSelf: "center",
  flexShrink: 0,
  color: "neutral.c70",
  ml: 6,
})``;

export const SelectInputLabel = styled(InputLabel).attrs({
  ml: -2,
  mr: 6,
})``;

/**
 * InputLabel with tooltip for use with Input's renderLeft prop
 */
export const InputLabelWithTooltip: React.FC<{
  children: string;
  hint: string;
}> = ({ children, hint }) => {
  return (
    <SimpleTooltip content={<Text color="neutral.c00">{hint}</Text>}>
      <Flex
        flexDirection="row"
        alignItems="center"
        columnGap={1}
        flexShrink={0}
      >
        <InputLabel>{children}</InputLabel>
        <Icons.Information size="XS" color="neutral.c70" />
      </Flex>
    </SimpleTooltip>
  );
};
