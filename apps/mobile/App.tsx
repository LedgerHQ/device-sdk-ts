/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from "react";
import { SafeAreaView, StatusBar, useColorScheme } from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import { RootNavigator } from "_navigators/RootNavigator";
import { DmkProvider } from "_providers/dmkProvider";

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === "dark";

  const backgroundStyle = {
    backgroundColor: isDarkMode ? "white" : "black",
    flex: 1,
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <NavigationContainer>
        <DmkProvider>
          <RootNavigator />
        </DmkProvider>
      </NavigationContainer>
    </SafeAreaView>
  );
}

export default App;
