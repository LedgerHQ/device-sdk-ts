import React, { useEffect, useState } from "react";
import { Linking } from "react-native";
import { type ThemeProps } from "_common/types.ts";
import { useMockServer } from "_providers/mockServerProvider";
import { BaseInput, Button, Flex, Text } from "@ledgerhq/native-ui";
import styled from "styled-components/native";

const Panel = styled(Flex)<ThemeProps>`
  width: 100%;
  border-radius: 8px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.neutral.c40};
  padding: 12px;
  row-gap: 8px;
`;

const Label = styled(Text)`
  font-weight: bold;
`;

/** The mock server UI, signed into the session when a token is given. */
const sessionUiUrl = (url: string, token: string) => {
  const base = url.trim().replace(/\/+$/, "");
  return token.trim() ? `${base}/#token=${token.trim()}` : base;
};

/**
 * Which mock server session the app's mock transport lists devices from.
 * Devices are added to it from the mock server UI, opened with the link shown.
 */
export const MockServerSessionPanel: React.FC = () => {
  const { session, selectSession } = useMockServer();
  const [url, setUrl] = useState(session.url);
  const [token, setToken] = useState("");

  useEffect(() => {
    setUrl(session.url);
    if (session.status === "ready") setToken(session.token);
  }, [session]);

  const status =
    session.status === "ready"
      ? "Session ready"
      : session.status === "connecting"
        ? "Connecting…"
        : `Unavailable: ${session.error}`;

  return (
    <Panel>
      <Label variant="body">Mock server</Label>
      <Text variant="small" color="neutral.c70">
        {status}
      </Text>
      <BaseInput
        value={url}
        onChange={setUrl}
        placeholder="Mock server URL"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <BaseInput
        value={token}
        onChange={setToken}
        placeholder="Session token, or empty for a new session"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Flex flexDirection="row" flexWrap="wrap" columnGap={8} rowGap={8}>
        <Button
          type="color"
          size="small"
          onPress={() => selectSession(url, token)}>
          Use this session
        </Button>
        <Button
          type="shade"
          size="small"
          onPress={() => void Linking.openURL(sessionUiUrl(url, token))}>
          Open in browser
        </Button>
        <Button type="shade" size="small" onPress={() => selectSession(url)}>
          New session
        </Button>
      </Flex>
      {session.status === "ready" ? (
        <Text variant="small" color="neutral.c70" selectable>
          Add devices from the mock server UI:{"\n"}
          {session.url}/#token={session.token}
        </Text>
      ) : null}
    </Panel>
  );
};
