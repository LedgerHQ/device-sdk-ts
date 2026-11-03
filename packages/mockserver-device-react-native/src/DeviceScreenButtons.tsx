import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";
import { useButtonHold } from "@ledgerhq/device-mockserver-react-core";

import { type Palette } from "./theme";

const BUTTONS: { button: SpeculosButton; label: string }[] = [
  { button: "left", label: "Left" },
  { button: "both", label: "Both" },
  { button: "right", label: "Right" },
];

/** Declaring it routes a screen reader's double tap to onAccessibilityAction. */
const ACCESSIBILITY_ACTIONS = [{ name: "activate" }];

type DeviceScreenButtonsProps = {
  palette: Palette;
  onPress: (button: SpeculosButton, action: SpeculosAction) => void;
};

export const DeviceScreenButtons: React.FC<DeviceScreenButtonsProps> = ({
  palette,
  onPress,
}) => {
  const { hold, release } = useButtonHold(onPress);

  // In and out rather than onPress, which only fires once the finger is up:
  // a hold needs both ends. A screen reader activates without either, so its
  // activation is one click; a touch never fires an accessibility action.
  return (
    <View style={styles.row}>
      {BUTTONS.map(({ button, label }) => (
        <Pressable
          key={button}
          accessibilityRole="button"
          accessibilityLabel={`${label} button`}
          accessibilityActions={ACCESSIBILITY_ACTIONS}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === "activate") {
              onPress(button, "press-and-release");
            }
          }}
          onPressIn={() => hold(button)}
          onPressOut={() => release()}
          style={({ pressed }) => [
            styles.button,
            {
              borderColor: palette.border,
              backgroundColor: pressed ? palette.buttonPressed : palette.button,
            },
          ]}
          testID={`button_device-screen-${button}`}
        >
          <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
  },
  label: {
    fontSize: 14,
  },
});
