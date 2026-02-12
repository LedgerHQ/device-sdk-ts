import React from "react";
import { Flex, Icons } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { SCROLL_BUTTON_CONFIG } from "./constants";

const StyledButton = styled(Flex)`
  position: absolute;
  bottom: ${SCROLL_BUTTON_CONFIG.BOTTOM_OFFSET}px;
  right: ${SCROLL_BUTTON_CONFIG.RIGHT_OFFSET}px;
  height: ${SCROLL_BUTTON_CONFIG.SIZE}px;
  width: ${SCROLL_BUTTON_CONFIG.SIZE}px;
  padding-top: ${SCROLL_BUTTON_CONFIG.PADDING_TOP}px;
  border-radius: ${SCROLL_BUTTON_CONFIG.BORDER_RADIUS}px;
  cursor: pointer;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  transition: opacity 0.3s;
  opacity: ${({ enabled }: { enabled: boolean }) => (enabled ? 0 : 1)};
  pointer-events: ${({ enabled }: { enabled: boolean }) =>
    enabled ? "none" : "auto"};
`;

type ScrollDownButtonProps = {
  onClick: () => void;
  enabled: boolean;
};

export const ScrollDownButton: React.FC<ScrollDownButtonProps> = ({
  onClick,
  enabled,
}) => (
  <StyledButton
    enabled={enabled}
    onClick={onClick}
    alignItems="center"
    justifyContent="center"
    bg="neutral.c100"
  >
    <Icons.ChevronDown size="XL" color="neutral.c00" />
  </StyledButton>
);
