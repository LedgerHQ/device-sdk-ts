import { DEFAULT_SCREENS } from "@internal/config/defaultScreens";
import type { ButtonController } from "@internal/core/ButtonController";
import type {
  ButtonKey,
  DeviceControllerOptions,
  DeviceScreens,
  PercentCoordinates,
} from "@internal/core/types";
import { createDefaultControllers } from "@root/src/internal/di";
import {
  pressButtons,
  pressSequence,
} from "@root/src/internal/use-cases/buttonUseCases";
import { tapLong, tapQuick } from "@root/src/internal/use-cases/touchUseCases";

export type ButtonFactory = () => ButtonController & {
  left(): Promise<void>;
  right(): Promise<void>;
  both(): Promise<void>;
  pressSequence(keys: ButtonKey[], delayMs?: number): Promise<void>;
};

export type TapFactory = (deviceKey: string) => {
  tapQuick: (point: PercentCoordinates) => Promise<void>;
  tapLong: (point: PercentCoordinates) => Promise<void>;
};

export type DeviceControllerClientFactory = (
  baseURL: string,
  opts?: {
    timeoutMs?: number;
    clientHeader?: string;
    screens?: DeviceScreens<string>;
  },
) => DeviceControllerClient;

export type DeviceControllerClient = {
  buttonFactory: ButtonFactory;
  tapFactory: TapFactory;
};

export const deviceControllerClientFactory: DeviceControllerClientFactory = (
  baseURL,
  opts = {},
) => {
  const resolved: DeviceControllerOptions = {
    screens: opts.screens ?? DEFAULT_SCREENS,
    timeoutMs: opts.timeoutMs,
    clientHeader: opts.clientHeader,
  };

  const { buttons, touch } = createDefaultControllers(baseURL, resolved);
  const press = pressButtons(buttons);

  return {
    buttonFactory: () => ({
      press: (key) => buttons.press(key),
      left: () => press.left(),
      right: () => press.right(),
      both: () => press.both(),
      pressSequence: (keys, delayMs) => pressSequence(buttons, keys, delayMs),
    }),
    tapFactory: (key) => ({
      tapQuick: tapQuick(touch, key),
      tapLong: tapLong(touch, key),
    }),
  };
};

export type {
  ButtonKey,
  DeviceControllerOptions,
  DeviceScreens,
  PercentCoordinates,
};
