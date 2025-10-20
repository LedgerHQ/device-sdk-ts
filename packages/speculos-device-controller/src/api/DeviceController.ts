import { DEFAULT_SCREENS } from "@internal/config/defaultScreens";
import type { IButtonController } from "@internal/core/IButtonController";
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

export type ButtonAPI = IButtonController & {
  left(): Promise<void>;
  right(): Promise<void>;
  both(): Promise<void>;
  pressSequence(keys: ButtonKey[], delayMs?: number): Promise<void>;
};

export type TouchAPI = {
  createTap: (deviceKey: string) => {
    tapQuick: (point: PercentCoordinates) => Promise<void>;
    tapLong: (point: PercentCoordinates) => Promise<void>;
  };
};

export type DeviceAPI = {
  button: ButtonAPI;
  touch: TouchAPI;
};

export function deviceControllerFactory(
  baseURL: string,
  opts: {
    timeoutMs?: number;
    clientHeader?: string;
    screens?: DeviceScreens<string>;
  } = {},
): DeviceAPI {
  const resolved: DeviceControllerOptions = {
    screens: opts.screens ?? DEFAULT_SCREENS,
    timeoutMs: opts.timeoutMs,
    clientHeader: opts.clientHeader,
  };

  const { buttons, touch } = createDefaultControllers(baseURL, resolved);
  const press = pressButtons(buttons);

  return {
    button: {
      press: (k) => buttons.press(k),
      left: () => press.left(),
      right: () => press.right(),
      both: () => press.both(),
      pressSequence: (keys, delayMs) => pressSequence(buttons, keys, delayMs),
    },
    touch: {
      createTap: (key) => ({
        tapQuick: tapQuick(touch, key),
        tapLong: tapLong(touch, key),
      }),
    },
  };
}

export type {
  ButtonKey,
  DeviceControllerOptions,
  DeviceScreens,
  PercentCoordinates,
};
