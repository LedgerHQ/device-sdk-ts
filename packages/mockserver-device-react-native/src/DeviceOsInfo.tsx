import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { type Device } from "@ledgerhq/device-mockserver-client";
import {
  appIconUrl,
  type DeviceScreenModel,
  openableApps,
  useOpenApp,
} from "@ledgerhq/device-mockserver-react-core";

import { ScreenFrame } from "./ScreenFrame";
import { type Palette, screenColors } from "./theme";

const ICON_SIZE = 40;

type AppIconProps = {
  name: string;
  palette: Palette;
};

const AppIcon: React.FC<AppIconProps> = ({ name, palette }) => {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <View style={[styles.icon, { backgroundColor: palette.button }]}>
        <Text style={[styles.initial, { color: palette.mutedText }]}>
          {name.charAt(0)}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: appIconUrl(name) }}
      onError={() => setMissing(true)}
      style={styles.icon}
    />
  );
};

type DeviceOsInfoProps = {
  device: Device;
  model: DeviceScreenModel;
  palette: Palette;
  /** Omitted, the apps are listed but cannot be opened. */
  onOpenApp?: (appName: string) => Promise<void>;
};

export const DeviceOsInfo: React.FC<DeviceOsInfoProps> = ({
  device,
  model,
  palette,
  onOpenApp,
}) => {
  const apps = openableApps(device);
  const { opening, error, open } = useOpenApp(onOpenApp);
  const screen = screenColors(model);

  return (
    <View style={styles.container} testID="container_device-os-info">
      <ScreenFrame palette={palette}>
        <View
          style={{
            aspectRatio: model.screenWidth / model.screenHeight,
            backgroundColor: screen.background,
          }}
          testID="list_device-apps"
        >
          {apps.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: screen.text }]}>
                No apps installed
              </Text>
            </View>
          ) : (
            // A touch screen scrolls its grid down, a Nano its row across.
            <ScrollView
              horizontal={!model.touch}
              contentContainerStyle={model.touch ? styles.grid : styles.row}
            >
              {apps.map((app) => (
                <Pressable
                  key={app.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${app.name} ${app.version}`}
                  disabled={!onOpenApp || opening !== undefined}
                  onPress={() => open(app.name)}
                  style={model.touch ? styles.gridTile : styles.rowTile}
                  testID={`button_open-app-${app.name}`}
                >
                  <AppIcon name={app.name} palette={palette} />
                  <Text
                    numberOfLines={1}
                    style={[styles.appName, { color: screen.text }]}
                  >
                    {app.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {opening !== undefined ? (
            <View
              style={[styles.opening, { backgroundColor: screen.overlay }]}
              testID="spinner_opening-app-screen"
            >
              <ActivityIndicator color={screen.text} />
              <Text style={[styles.appName, { color: screen.text }]}>
                Opening {opening}
              </Text>
            </View>
          ) : null}
        </View>
      </ScreenFrame>
      {error ? (
        <Text style={[styles.error, { color: palette.error }]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  gridTile: {
    width: "33.33%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  row: {
    alignItems: "center",
    gap: 8,
    padding: 8,
  },
  rowTile: {
    width: 88,
    alignItems: "center",
    gap: 6,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontSize: 18,
    fontWeight: "600",
  },
  appName: {
    fontSize: 12,
    textAlign: "center",
  },
  opening: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  error: {
    fontSize: 13,
    textAlign: "center",
  },
});
