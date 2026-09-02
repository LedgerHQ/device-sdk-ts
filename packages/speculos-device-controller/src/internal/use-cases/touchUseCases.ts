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

const BLIND_SIGNING_TOGGLE_COORDS = {
  stax: { x: 88, y: 51 },
  flex: { x: 88, y: 58 },
  apex: { x: 88, y: 58 },
} as const satisfies Record<string, PercentCoordinates>;

type BlindSigningTouchKey = keyof typeof BLIND_SIGNING_TOGGLE_COORDS;

const isBlindSigningTouchKey = (key: string): key is BlindSigningTouchKey =>
  Object.hasOwn(BLIND_SIGNING_TOGGLE_COORDS, key);

const DEFAULT_BLIND_SIGNING_TOGGLE_COORDS: PercentCoordinates = {
  x: 88,
  y: 51,
};

export const enableBlindSigningSettings =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () => {
    const point = isBlindSigningTouchKey(deviceKey)
      ? BLIND_SIGNING_TOGGLE_COORDS[deviceKey]
      : DEFAULT_BLIND_SIGNING_TOGGLE_COORDS;
    await tapQuick(touch, deviceKey)(point);
  };

/**
 * Confirm button of the Address Book review (REGISTER IDENTITY). NBGL's
 * "review light" puts this button above the page footer rather than in it, so
 * neither mainButton() nor secondaryButton() reaches it. Measured on Speculos:
 * flex 480x600 -> button centre y=436 (72%), stax 400x672 -> y=520 (77%).
 */
const ADDRESS_BOOK_CONFIRM_COORDS = {
  stax: { x: 50, y: 77 },
  flex: { x: 50, y: 72 },
} as const satisfies Record<string, PercentCoordinates>;

type AddressBookConfirmKey = keyof typeof ADDRESS_BOOK_CONFIRM_COORDS;

const isAddressBookConfirmKey = (key: string): key is AddressBookConfirmKey =>
  Object.hasOwn(ADDRESS_BOOK_CONFIRM_COORDS, key);

/** Flex's placement, used for any touchscreen model not measured above. */
const DEFAULT_ADDRESS_BOOK_CONFIRM_COORDS: PercentCoordinates = {
  x: 50,
  y: 72,
};

export const confirmAddressBookReview =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () => {
    const point = isAddressBookConfirmKey(deviceKey)
      ? ADDRESS_BOOK_CONFIRM_COORDS[deviceKey]
      : DEFAULT_ADDRESS_BOOK_CONFIRM_COORDS;
    await tapQuick(touch, deviceKey)(point);
  };

export const continueToBlindSigning =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 50, y: 94 });

export const acceptBlindSigning =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async () =>
    await tapQuick(touch, deviceKey)({ x: 50, y: 94 });
