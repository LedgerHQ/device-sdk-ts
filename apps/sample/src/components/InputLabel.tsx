import { Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

export const InputLabel = styled(Text).attrs({
  fontSize: "12px",
  alignSelf: "center",
  flexShrink: 0,
  color: "neutral.c70",
  ml: 6,
  paddingTop: "1px",
})``;

export const SelectInputLabel = styled(InputLabel).attrs({
  ml: -2,
  mr: 6,
})``;
