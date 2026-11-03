import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  type DeviceScreenModel,
  type DeviceScreenState,
  findDeviceScreenModel,
  type ScreenApi,
  useScreenPolling,
} from "@ledgerhq/device-mockserver-react-core";

import { DeviceOsInfo } from "./DeviceOsInfo";
import { DeviceScreenButtons } from "./DeviceScreenButtons";
import { DeviceScreenImage } from "./DeviceScreenImage";
import { nativeScreenPlatform } from "./nativeScreenPlatform";
import { Notice } from "./Notice";
import { ScreenFrame } from "./ScreenFrame";
import {
  type ColorScheme,
  type Palette,
  screenColors,
  usePalette,
} from "./theme";

export type DeviceScreenProps = {
  api: ScreenApi;
  /** The mock server's `device_type`, a DMK `DeviceModelId`. */
  deviceType: string;
  /** For the controls around the screen. The system's when omitted. */
  colorScheme?: ColorScheme;
};

/**
 * The screen inline, as wide as its container allows. It polls while mounted,
 * so a host hiding it unmounts it.
 */
export const DeviceScreen: React.FC<DeviceScreenProps> = ({
  api,
  deviceType,
  colorScheme,
}) => {
  const model = findDeviceScreenModel(deviceType);
  const palette = usePalette(colorScheme);
  const state = useScreenPolling(api, true, nativeScreenPlatform);

  return (
    <View style={styles.container} testID="container_device-screen">
      {renderScreen(state, model, api, palette)}
    </View>
  );
};

function renderScreen(
  state: DeviceScreenState,
  model: DeviceScreenModel,
  api: ScreenApi,
  palette: Palette,
) {
  switch (state.kind) {
    case "loading": {
      const screen = screenColors(model);
      return (
        <ScreenFrame palette={palette}>
          <View
            style={[
              styles.placeholder,
              {
                aspectRatio: model.screenWidth / model.screenHeight,
                backgroundColor: screen.background,
              },
            ]}
            testID="placeholder_device-screen-loading"
          >
            <ActivityIndicator color={screen.text} />
          </View>
        </ScreenFrame>
      );
    }
    case "error":
      return (
        <Notice
          palette={palette}
          tone="error"
          title="Screen unavailable"
          description={state.message}
          testID="banner_device-screen-error"
        />
      );
    case "os-info":
      return (
        <>
          <DeviceOsInfo
            device={state.device}
            model={model}
            palette={palette}
            onOpenApp={model.speculos ? api.openApp : undefined}
          />
          {model.speculos ? null : (
            <Notice
              palette={palette}
              tone="info"
              title="No screen to capture"
              description={`Speculos has no emulator for the ${model.label}, so this device is mocked all the way through and has no screen.`}
              testID="banner_device-screen-no-emulator"
            />
          )}
        </>
      );
    case "image":
      return (
        <>
          <DeviceScreenImage
            src={state.src}
            model={model}
            palette={palette}
            onTouch={model.touch ? state.input.touch : undefined}
          />
          {model.touch ? null : (
            <DeviceScreenButtons
              palette={palette}
              onPress={state.input.pressButton}
            />
          )}
        </>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 8,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
