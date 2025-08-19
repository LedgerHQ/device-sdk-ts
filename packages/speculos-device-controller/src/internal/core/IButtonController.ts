import type { ButtonKey } from "./types";

export interface IButtonController {
  press(key: ButtonKey): Promise<void>;
}
