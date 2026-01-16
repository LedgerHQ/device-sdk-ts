import React from "react";
import { Flex, Icons, Text, Tooltip } from "@ledgerhq/react-ui";

export const InputHeader: React.FC<{ children: string; hint: string }> = ({
  children,
  hint,
}) => {
  return (
    <Tooltip content={<Text color="neutral.c00">{hint}</Text>} placement="top">
      <Flex
        alignSelf="flex-start"
        flexDirection="row"
        alignItems="center"
        columnGap={2}
      >
        <Text variant="body">{children}</Text>
        <Icons.Information size="XS" color="neutral.c70" />
      </Flex>
    </Tooltip>
  );
};
