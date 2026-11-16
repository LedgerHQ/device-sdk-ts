/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useMemo } from "react";
import { StatusBar, useColorScheme } from "react-native";
import { RootNavigator } from "_navigators/RootNavigator";
import { getNavigationTheme } from "_navigators/styles.ts";
import { DeviceSessionsProvider } from "_providers/deviceSessionsProvider.tsx";
import { DevToolsConnectorProvider } from "_providers/devToolsConnectorProvider";
import { DmkProvider } from "_providers/dmkProvider";
import {
  MockServerProvider,
  useMockServer,
} from "_providers/mockServerProvider";
import { StyleProvider } from "@ledgerhq/native-ui";
import styled, { useTheme } from "styled-components/native";

const Container = styled.SafeAreaView`
  flex: 1;
`;

function StyledApp(): React.JSX.Element {
  const theme = useTheme();
  const navigationTheme = useMemo(() => getNavigationTheme(theme), [theme]);
  const { session } = useMockServer();
  const mockServer =
    session.status === "ready"
      ? { url: session.url, token: session.token }
      : undefined;
  // A new mock server session needs a new DMK, so the app restarts on it.
  return (
    <DevToolsConnectorProvider>
      <DmkProvider
        key={mockServer ? `${mockServer.url}#${mockServer.token}` : "none"}
        mockServer={mockServer}>
        <DeviceSessionsProvider>
          <RootNavigator theme={navigationTheme} />
        </DeviceSessionsProvider>
      </DmkProvider>
    </DevToolsConnectorProvider>
  );
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === "dark";

  return (
    <Container>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <StyleProvider selectedPalette={isDarkMode ? "dark" : "light"}>
        <MockServerProvider>
          <StyledApp />
        </MockServerProvider>
      </StyleProvider>
    </Container>
  );
}

export default App;
