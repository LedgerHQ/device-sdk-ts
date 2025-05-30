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
import { DmkProvider } from "_providers/dmkProvider";
import { StyleProvider } from "@ledgerhq/native-ui";
import styled, { useTheme } from "styled-components/native";

const Container = styled.SafeAreaView`
  flex: 1;
`;

function StyledApp(): React.JSX.Element {
  const theme = useTheme();
  const navigationTheme = useMemo(() => getNavigationTheme(theme), [theme]);
  return (
    <DmkProvider>
      <DeviceSessionsProvider>
        <RootNavigator theme={navigationTheme} />
      </DeviceSessionsProvider>
    </DmkProvider>
  );
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === "dark";

  return (
    <Container>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <StyleProvider selectedPalette={isDarkMode ? "dark" : "light"}>
        <StyledApp />
      </StyleProvider>
    </Container>
  );
}

export default App;
