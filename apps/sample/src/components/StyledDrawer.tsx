import React, { useEffect } from "react";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled, { css, keyframes } from "styled-components";

const DescriptionText = styled(Text).attrs({
  mb: 5,
  variant: "body",
  color: "opacityDefault.c60",
})`
  font-weight: regular;
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideIn = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  animation: ${fadeIn} 0.2s ease-out;
`;

const Panel = styled(Flex)<{ $big: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 101;
  background: ${(p) => p.theme.colors.background.main};
  flex-direction: column;
  overflow: hidden;
  animation: ${slideIn} 0.25s ease-out;

  ${(p) =>
    p.$big
      ? css`
          width: 60%;
          max-width: 700px;
        `
      : css`
          width: 35%;
          max-width: 420px;
        `}
`;

const Header = styled(Flex).attrs({
  px: 8,
  py: 6,
})`
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${(p) => p.theme.colors.neutral.c40};
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${(p) => p.theme.colors.neutral.c80};
  padding: 4px;
  display: flex;
  align-items: center;

  &:hover {
    color: ${(p) => p.theme.colors.neutral.c100};
  }
`;

const Content = styled(Flex).attrs({ px: 8, py: 6 })`
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

export const StyledDrawer: React.FC<{
  title: string;
  big: boolean;
  isOpen: boolean;
  onClose(): void;
  children: React.ReactNode;
  description?: string;
}> = ({ title, description, big, isOpen, onClose, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <Overlay onClick={onClose} />
      <Panel $big={big}>
        <Header>
          <Text variant="h5Inter" color="neutral.c100">
            {title}
          </Text>
          <CloseButton onClick={onClose} aria-label="Close">
            <Icons.Close size="S" />
          </CloseButton>
        </Header>
        <Content>
          <Flex flexDirection="column" rowGap={4} flex={1} overflowY="hidden">
            {description && <DescriptionText>{description}</DescriptionText>}
            {children}
          </Flex>
        </Content>
      </Panel>
    </>
  );
};
