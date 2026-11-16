import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { type Palette } from "./theme";

type NoticeProps = {
  palette: Palette;
  tone: "error" | "info";
  title: string;
  description: string;
  testID?: string;
};

export const Notice: React.FC<NoticeProps> = ({
  palette,
  tone,
  title,
  description,
  testID,
}) => (
  <View
    style={[
      styles.notice,
      { borderColor: tone === "error" ? palette.error : palette.border },
    ]}
    testID={testID}
  >
    <Text
      style={[
        styles.title,
        { color: tone === "error" ? palette.error : palette.text },
      ]}
    >
      {title}
    </Text>
    <Text style={[styles.description, { color: palette.mutedText }]}>
      {description}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  description: {
    fontSize: 13,
  },
});
