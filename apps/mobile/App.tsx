/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {SafeAreaView, useColorScheme, View, Text} from 'react-native';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? 'white' : 'black',
    flex: 1,
  };

  const textStyle = {
    color: isDarkMode ? 'black' : 'white',
  };

  return (
    <View style={backgroundStyle}>
      <SafeAreaView>
        <Text style={textStyle}>yo</Text>
      </SafeAreaView>
    </View>
  );
}

export default App;
