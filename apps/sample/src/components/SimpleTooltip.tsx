import React from "react";
import styled from "styled-components";

const TooltipWrapper = styled.span`
  position: relative;
  display: inline-flex;

  &:hover > [data-tooltip] {
    visibility: visible;
    opacity: 1;
  }
`;

const TooltipContent = styled.div`
  visibility: hidden;
  opacity: 0;
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral.c100};
  white-space: pre-wrap;
  max-width: 400px;
  z-index: 10;
  transition:
    opacity 0.15s,
    visibility 0.15s;
  pointer-events: none;
`;

export const SimpleTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactNode;
}> = ({ content, children }) => (
  <TooltipWrapper>
    {children}
    <TooltipContent data-tooltip>{content}</TooltipContent>
  </TooltipWrapper>
);
