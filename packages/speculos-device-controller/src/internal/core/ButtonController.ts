import type { ButtonKey } from "./types";

export interface ButtonController {
  press(key: ButtonKey): Promise<void>;
}
