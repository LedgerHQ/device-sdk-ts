import { DEFAULT_SCREENS } from "@internal/config/defaultScreens";
import type { IButtonController } from "@internal/core/IButtonController";
import type { ITouchController } from "@internal/core/ITouchController";
import type {
  ButtonKey,
  DeviceControllerOptions,
  DeviceScreens,
  PercentPoint,
} from "@internal/core/types";
import { speculosDeviceControllerTypes } from "@root/src/internal/core/speculosDeviceControllerTypes";
import { buildContainer } from "@root/src/internal/di";
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
    tapQuick: (point: PercentPoint) => Promise<void>;
    tapLong: (point: PercentPoint) => Promise<void>;
  };
};

export type DeviceAPI = {
  button: ButtonAPI;
  touch: TouchAPI;
};

type BaseOpts = {
  timeoutMs?: number;
  clientHeader?: string;
  screens?: DeviceScreens<string>;
};

export function deviceControllerFactory(
  baseURL: string,
  opts: BaseOpts = {},
): DeviceAPI {
  const resolved: DeviceControllerOptions<string> = {
    screens: opts.screens ?? DEFAULT_SCREENS,
    timeoutMs: opts.timeoutMs,
    clientHeader: opts.clientHeader,
  };

  const container = buildContainer<string>(baseURL, resolved);

  const buttons = container.get<IButtonController>(
    speculosDeviceControllerTypes.ButtonController,
  );
  const press = pressButtons(buttons);
  const touch = container.get<ITouchController<string>>(
    speculosDeviceControllerTypes.TouchController,
  );

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

export type { ButtonKey, DeviceControllerOptions, DeviceScreens, PercentPoint };
