import React from "react";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { SimpleTooltip } from "@/components/SimpleTooltip";

const BoxTitle = styled(Text).attrs({
  variant: "h5Inter",
  color: "neutral.c70",
})``;

export const BoxHeader: React.FC<{ children: string; hint: string }> = ({
  children,
  hint,
}) => {
  return (
    <SimpleTooltip content={<Text color="neutral.c00">{hint}</Text>}>
      <Flex
        alignSelf="flex-start"
        flexDirection="row"
        alignItems="center"
        columnGap={2}
        flexGrow={0}
      >
        <BoxTitle>{children}</BoxTitle>
        <Icons.Information size="XS" color="neutral.c70" />
      </Flex>
    </SimpleTooltip>
  );
};
