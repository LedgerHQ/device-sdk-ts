import React, { useCallback, useState } from "react";
import { Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

const CopyFeedback = styled(Text).attrs({
  variant: "extraSmall",
  color: "neutral.c70",
})<{ $visible: boolean }>`
  display: ${({ $visible }) => ($visible ? "inline" : "none")};
  margin-left: 8px;
  opacity: 0;
  vertical-align: middle;
`;

const CopyIconWrapper = styled.span`
  display: inline;
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
  vertical-align: middle;
`;

const CopyableContainer = styled.span`
  cursor: pointer;
  word-break: break-all;

  &:hover ${CopyIconWrapper} {
    opacity: 1;
  }

  &:hover ${CopyFeedback} {
    opacity: 1;
  }
`;

const CopyableText = styled(Text).attrs({
  variant: "body",
  color: "neutral.c100",
})`
  display: inline;

  ${CopyableContainer}:hover & {
    text-decoration: underline;
  }
`;

/**
 * A component that allows copying text to the clipboard when clicked.
 * @param props.copyValue - The text to copy to the clipboard.
 * @param props.children - The content to display.
 * @returns A component that allows copying text to the clipboard when clicked.
 */
export const Copyable: React.FC<{
  copyValue: string;
  children: React.ReactNode;
}> = ({ copyValue, children }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(() => {
    void navigator.clipboard.writeText(copyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [copyValue]);

  return (
    <CopyableContainer onClick={copyToClipboard}>
      <CopyableText>{children}</CopyableText>
      <CopyIconWrapper>
        <Icons.Copy size="XS" color="neutral.c70" />
      </CopyIconWrapper>
      <CopyFeedback $visible={copied}>copied</CopyFeedback>
    </CopyableContainer>
  );
};
