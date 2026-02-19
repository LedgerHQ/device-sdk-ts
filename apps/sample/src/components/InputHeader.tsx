import React from "react";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";

import { SimpleTooltip } from "@/components/SimpleTooltip";

export const InputHeader: React.FC<{ children: string; hint: string }> = ({
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
      >
        <Text variant="body">{children}</Text>
        <Icons.Information size="XS" color="neutral.c70" />
      </Flex>
    </SimpleTooltip>
  );
};
