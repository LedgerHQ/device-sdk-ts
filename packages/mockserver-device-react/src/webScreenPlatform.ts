import { type ScreenPlatform } from "@ledgerhq/device-mockserver-react-core";

export const webScreenPlatform: ScreenPlatform = {
  toImageSource: (screenshot) =>
    Promise.resolve(URL.createObjectURL(screenshot)),
  releaseImageSource: (source) => URL.revokeObjectURL(source),
  isHidden: () => document.hidden,
};
