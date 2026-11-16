import React, { useEffect, useMemo, useState } from "react";
import {
  type GestureResponderEvent,
  Image,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { type SpeculosAction } from "@ledgerhq/device-mockserver-client";
import {
  type DeviceScreenModel,
  type Size,
  toScreenPoint,
  useTouchHold,
} from "@ledgerhq/device-mockserver-react-core";

import { pngSize } from "./pngSize";
import { ScreenFrame } from "./ScreenFrame";
import { type Palette } from "./theme";

const sameSize = (a: Size, b: Size) =>
  a.width === b.width && a.height === b.height;

type DeviceScreenImageProps = {
  src: string;
  model: DeviceScreenModel;
  palette: Palette;
  /** Omitted for a button-driven device. */
  onTouch?: (x: number, y: number, action: SpeculosAction) => void;
};

export const DeviceScreenImage: React.FC<DeviceScreenImageProps> = ({
  src,
  model,
  palette,
  onTouch,
}) => {
  const [undecodable, setUndecodable] = useState(false);
  const [drawn, setDrawn] = useState<Size>({ width: 0, height: 0 });
  /** The frame's own pixels; the model's size stands in for an unreadable one. */
  const screen = useMemo<Size>(
    () =>
      pngSize(src) ?? { width: model.screenWidth, height: model.screenHeight },
    [src, model],
  );
  const touch = useTouchHold(onTouch);

  useEffect(() => setUndecodable(false), [src]);

  const handleLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    const next = { width: layout.width, height: layout.height };
    setDrawn((current) => (sameSize(current, next) ? current : next));
  };

  const handleGrant = ({ nativeEvent }: GestureResponderEvent) => {
    const point = toScreenPoint(
      nativeEvent.locationX,
      nativeEvent.locationY,
      drawn,
      screen,
    );
    if (point) touch.hold(point);
  };

  if (undecodable) {
    return (
      <Text
        style={[styles.undecodable, { color: palette.error }]}
        testID="text_device-screen-undecodable"
      >
        Screenshot could not be decoded
      </Text>
    );
  }

  return (
    <ScreenFrame palette={palette}>
      <View
        onLayout={handleLayout}
        onStartShouldSetResponder={() => onTouch !== undefined}
        // A hold must not end because a scroll view around it took over.
        onResponderTerminationRequest={() => false}
        onResponderGrant={handleGrant}
        onResponderRelease={() => touch.release()}
        onResponderTerminate={() => touch.release()}
        testID="area_device-screen-touch"
      >
        <Image
          source={{ uri: src }}
          accessibilityLabel="Device screen"
          // Each frame is a new source; fading it in would blink the screen.
          fadeDuration={0}
          resizeMode="contain"
          onError={() => setUndecodable(true)}
          style={[styles.image, { aspectRatio: screen.width / screen.height }]}
          testID="image_device-screen"
        />
      </View>
    </ScreenFrame>
  );
};

const styles = StyleSheet.create({
  image: {
    width: "100%",
    backgroundColor: "#000000",
  },
  undecodable: {
    fontSize: 13,
    textAlign: "center",
  },
});
