import { Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

export const Container = styled(Flex)`
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: ${(p) => p.theme.colors.neutral.c30};
  border-radius: 8px;
`;

export const PreviewImage = styled.img`
  max-width: 300px;
  max-height: 400px;
  border: 1px solid ${(p) => p.theme.colors.neutral.c50};
  border-radius: 4px;
  object-fit: contain;
`;

export const MetadataContainer = styled(Flex)`
  flex-direction: column;
  gap: 4px;
  align-items: center;
`;

export const MetadataText = styled(Text).attrs({
  variant: "small",
  color: "neutral.c70",
})``;

export const HashText = styled(Text).attrs({
  variant: "extraSmall",
  color: "neutral.c60",
})`
  font-family: monospace;
  word-break: break-all;
  max-width: 300px;
  text-align: center;
`;
