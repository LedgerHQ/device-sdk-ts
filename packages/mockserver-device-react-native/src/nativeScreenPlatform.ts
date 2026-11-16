import { AppState } from "react-native";
import { type ScreenPlatform } from "@ledgerhq/device-mockserver-react-core";

/** React Native's Image cannot draw a Blob, so a frame goes as a data URI. */
const toDataUri = (screenshot: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Screenshot could not be read"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Screenshot could not be read"));
    reader.readAsDataURL(screenshot);
  });

export const nativeScreenPlatform: ScreenPlatform = {
  toImageSource: toDataUri,
  // An inactive app, under a system sheet, is still in sight.
  isHidden: () => AppState.currentState === "background",
};
