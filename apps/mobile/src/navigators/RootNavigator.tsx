import React from 'react';
import {Screens} from './RootNavigator.constants';
import {HomeScreen} from '_components/HomeScreen';
import {createStackNavigator} from '@react-navigation/stack';

const RootStackNavigator = createStackNavigator();

export const RootNavigator = () => (
  <RootStackNavigator.Navigator>
    <RootStackNavigator.Screen
      name={Screens.ROOT_SCREEN}
      component={HomeScreen}
      options={{header: () => null}}
    />
  </RootStackNavigator.Navigator>
);
