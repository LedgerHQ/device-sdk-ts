import { useColorScheme } from "react-native";
import { type DeviceScreenModel } from "@ledgerhq/device-mockserver-react-core";

export type ColorScheme = "light" | "dark";

/** The few colours around the screen, which is otherwise the device's own. */
export interface Palette {
  readonly text: string;
  readonly mutedText: string;
  readonly border: string;
  readonly button: string;
  readonly buttonPressed: string;
  readonly error: string;
}

const PALETTES: Record<ColorScheme, Palette> = {
  light: {
    text: "#141414",
    mutedText: "#6B6B6B",
    border: "#DADADA",
    button: "#F2F2F2",
    buttonPressed: "#DADADA",
    error: "#C8203F",
  },
  dark: {
    text: "#FFFFFF",
    mutedText: "#9E9E9E",
    border: "#3A3A3A",
    button: "#242424",
    buttonPressed: "#3A3A3A",
    error: "#FF6B81",
  },
};

/** The host's scheme when it gives one, the system's otherwise. */
export const usePalette = (colorScheme: ColorScheme | undefined): Palette => {
  const system = useColorScheme();
  return PALETTES[colorScheme ?? (system === "dark" ? "dark" : "light")];
};

/** What the device draws on: a Stax screen is white, a Nano one black. */
export const screenColors = (model: DeviceScreenModel) =>
  model.lightScreen
    ? {
        background: "#FFFFFF",
        text: "#000000",
        overlay: "rgba(255,255,255,0.8)",
      }
    : { background: "#000000", text: "#FFFFFF", overlay: "rgba(0,0,0,0.8)" };
