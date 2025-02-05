import React from "react";
import { Screens } from "./RootNavigator.constants";
import { createStackNavigator } from "@react-navigation/stack";
import { HomeScreen } from "_components/HomeScreen";
import { ConnectDeviceScreen } from "_components/ConnectDeviceScreen.tsx";

const RootStackNavigator = createStackNavigator();

export const RootNavigator = () => (
  <RootStackNavigator.Navigator>
    <RootStackNavigator.Screen
      name={Screens.Home}
      component={HomeScreen}
      options={{ header: () => null }}
    />
    <RootStackNavigator.Screen
      name={Screens.ConnectDevice}
      component={ConnectDeviceScreen}
      options={{ header: () => null }}
    />
  </RootStackNavigator.Navigator>
);
