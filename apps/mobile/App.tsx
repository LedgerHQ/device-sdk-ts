/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import {HIDTransportTester} from '_components/HIDTransportTester';
import React from 'react';
import {SafeAreaView, useColorScheme, View} from 'react-native';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? 'black' : 'white',
    flex: 1,
  };

  return (
    <View style={backgroundStyle}>
      <SafeAreaView>
        <HIDTransportTester />
      </SafeAreaView>
    </View>
  );
}

export default App;
