import type { PercentCoordinates } from "@internal/core/types";
import { type TouchController } from "@root/src/internal/core/TouchController";

const TAP_LONG_TIME_MS = 5000;

export const tapLong =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async (point: PercentCoordinates, delayMs: number = TAP_LONG_TIME_MS) => {
    await touch.tap(deviceKey, point);
    await new Promise((r) => setTimeout(r, delayMs));
    await touch.release(deviceKey, point);
  };

export const tapQuick =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async (point: PercentCoordinates) =>
    await touch.tapAndRelease(deviceKey, point);

export const sign =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async (delayMs: number = TAP_LONG_TIME_MS) =>
    await tapLong(touch, deviceKey)({ x: 85, y: 80 }, delayMs);

export const reject =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 20, y: 90 });

export const navigateNext =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 90, y: 90 });

export const navigatePrevious =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 45, y: 90 });

export const mainButton =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 50, y: 80 });

export const secondaryButton =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 50, y: 90 });

export const enterMenu =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 85, y: 8 });

export const exitMenu =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 10, y: 4 });

export const enableBlindSigningSettings =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 88, y: 51 });

export const continueToBlindSigning =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 50, y: 94 });

export const acceptBlindSigning =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 50, y: 94 });

export const openMenu =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 85, y: 8 });

export const closeMenu =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 10, y: 4 });
