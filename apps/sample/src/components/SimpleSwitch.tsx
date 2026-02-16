import React from "react";
import { Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

const SwitchContainer = styled(Flex).attrs({
  alignItems: "center",
  flexDirection: "row",
})`
  width: fit-content;
  column-gap: ${(p) => p.theme.space[5]}px;
  cursor: pointer;

  &[data-disabled="true"] {
    cursor: unset;
    opacity: 0.5;
  }
`;

const SwitchTrack = styled.div<{ $checked: boolean }>`
  --ll-switch-width: ${(p) => p.theme.space[14]}px;
  --ll-switch-height: ${(p) => p.theme.space[9]}px;
  --ll-switch-padding: ${(p) => p.theme.space[2]}px;

  position: relative;
  display: inline-block;
  border-radius: ${(p) => p.theme.space[6]}px;
  width: var(--ll-switch-width);
  height: var(--ll-switch-height);
  background: ${(p) =>
    p.$checked ? p.theme.colors.primary.c80 : p.theme.colors.neutral.c60};
  transition: background 200ms;
  flex-shrink: 0;

  &:before {
    content: "";
    position: absolute;
    display: block;
    background: ${(p) => p.theme.colors.constant.white};
    border-radius: ${(p) => p.theme.space[12]}px;
    width: calc(calc(var(--ll-switch-width) / 2) - var(--ll-switch-padding));
    height: calc(calc(var(--ll-switch-width) / 2) - var(--ll-switch-padding));
    top: var(--ll-switch-padding);
    transform: translateX(
      ${(p) =>
        p.$checked
          ? "calc(var(--ll-switch-width) / 2)"
          : "var(--ll-switch-padding)"}
    );
    transition: transform 0.25s;
  }
`;

export const SimpleSwitch: React.FC<{
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label?: string;
  name?: string;
  "data-testid"?: string;
}> = ({ checked, disabled, onChange, label, name, "data-testid": testId }) => {
  const handleClick = () => {
    if (!disabled) onChange();
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key.match(/enter/i) && !disabled) onChange();
  };
  return (
    <SwitchContainer
      role="switch"
      aria-checked={checked}
      aria-label={name}
      data-disabled={disabled}
      data-testid={testId}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <SwitchTrack $checked={checked} />
      {label ? <Text variant="paragraph">{label}</Text> : null}
    </SwitchContainer>
  );
};
