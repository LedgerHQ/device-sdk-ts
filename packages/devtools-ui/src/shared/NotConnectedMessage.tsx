import React from "react";
import { Flex, Text } from "@ledgerhq/react-ui";

type Props = {
  title: string;
  description: React.ReactNode;
  codeExample: string;
};

export const NotConnectedMessage: React.FC<Props> = ({
  title,
  description,
  codeExample,
}) => (
  <Flex
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    flex={1}
    padding={6}
    style={{ opacity: 0.6 }}
  >
    <Text variant="h3" mb={4}>
      {title}
    </Text>
    <Text variant="body" textAlign="center" style={{ maxWidth: 500 }}>
      {description}
    </Text>
    <pre
      style={{
        background: "#f5f5f5",
        padding: 16,
        borderRadius: 8,
        marginTop: 16,
        fontSize: 12,
        overflow: "auto",
      }}
    >
      {codeExample}
    </pre>
  </Flex>
);
