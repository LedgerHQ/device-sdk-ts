import React from "react";
import { StyleSheet, View } from "react-native";

import { type Palette } from "./theme";

type ScreenFrameProps = {
  palette: Palette;
  children: React.ReactNode;
};

/**
 * The bezel around whatever stands in for the screen. The border lives here,
 * outside the content, so the live frame and the app list inside it take
 * exactly the screen's size.
 */
export const ScreenFrame: React.FC<ScreenFrameProps> = ({
  palette,
  children,
}) => (
  <View style={[styles.frame, { borderColor: palette.border }]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
});
