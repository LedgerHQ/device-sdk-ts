import {
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";

import { type Hold, useHold } from "./useHold";

export type ButtonHold = Hold<SpeculosButton>;

/** A physical button's down and up, as the actions the device gets. */
export const useButtonHold = (
  onPress: (button: SpeculosButton, action: SpeculosAction) => void,
): ButtonHold => useHold(onPress);
