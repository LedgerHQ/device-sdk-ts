/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from "react";
import { StatusBar, useColorScheme } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StyleProvider } from "@ledgerhq/native-ui";

import { RootNavigator } from "_navigators/RootNavigator";
import { DmkProvider } from "_providers/dmkProvider";
import styled from "styled-components/native";

const Container = styled.SafeAreaView`
  flex: 1;
`;

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === "dark";

  return (
    <Container>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <StyleProvider selectedPalette={isDarkMode ? "dark" : "light"}>
        <NavigationContainer>
          <DmkProvider>
            <RootNavigator />
          </DmkProvider>
        </NavigationContainer>
      </StyleProvider>
    </Container>
  );
}

export default App;
