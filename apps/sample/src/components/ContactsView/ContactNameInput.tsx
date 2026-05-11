import React, { useRef, useState } from "react";
import { type Contact } from "@ledgerhq/device-management-kit";
import { Flex, Input, Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import { InputLabel } from "@/components/InputLabel";

type Props = {
  value: string;
  onChange: (next: string) => void;
  contacts: Record<string, Contact>;
  disabled?: boolean;
};

const Wrapper = styled(Flex)`
  position: relative;
  flex-direction: column;
`;

const Popdown = styled(Flex)`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  flex-direction: column;
  margin-top: ${({ theme }: { theme: DefaultTheme }) => `${theme.space[1]}px`};
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c20};
  border-radius: ${({ theme }: { theme: DefaultTheme }) =>
    `${theme.space[2]}px`};
  max-height: 220px;
  overflow-y: auto;
`;

const Row = styled.button<{ active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  background: ${({
    theme,
    active,
  }: {
    theme: DefaultTheme;
    active?: boolean;
  }) => (active ? theme.colors.neutral.c30 : "transparent")};
  border: none;
  cursor: pointer;
  padding: ${({ theme }: { theme: DefaultTheme }) =>
    `${theme.space[2]}px ${theme.space[3]}px`};
  &:hover {
    background: ${({ theme }: { theme: DefaultTheme }) =>
      theme.colors.neutral.c30};
  }
`;

export const ContactNameInput: React.FC<Props> = ({
  value,
  onChange,
  contacts,
  disabled,
}) => {
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const names = Object.keys(contacts);
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const filtered = trimmed
    ? names.filter((n) => n.toLowerCase().includes(lower))
    : names;
  const exactMatch = trimmed && contacts[trimmed];

  const statusText = !trimmed
    ? null
    : exactMatch
      ? `Existing contact — a new address will be appended (${exactMatch.entries.length} existing).`
      : `Will create a new contact named "${trimmed}".`;

  const handleSelect = (name: string) => {
    onChange(name);
    setFocused(false);
  };

  // small delay so clicks on popdown rows fire before blur closes it
  const handleBlur = () => {
    blurTimer.current = window.setTimeout(() => setFocused(false), 120);
  };
  const handleFocus = () => {
    if (blurTimer.current !== null) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setFocused(true);
  };

  const showPopdown = focused && !disabled && filtered.length > 0;

  return (
    <Wrapper rowGap={1}>
      <Input
        renderLeft={() => <InputLabel>Contact name</InputLabel>}
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Type a name — pick existing or create new"
        data-testid="input-text_contactName"
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
      />
      {showPopdown && (
        <Popdown>
          {filtered.map((name) => {
            const c = contacts[name]!;
            return (
              <Row
                key={name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(name)}
              >
                <Text variant="body" color="neutral.c100">
                  {name}
                </Text>
                <Text variant="small" color="opacityDefault.c50">
                  {c.entries.length} address
                  {c.entries.length === 1 ? "" : "es"}
                </Text>
              </Row>
            );
          })}
        </Popdown>
      )}
      {statusText && (
        <Text
          variant="small"
          color={exactMatch ? "primary.c80" : "opacityDefault.c60"}
        >
          {statusText}
        </Text>
      )}
    </Wrapper>
  );
};
