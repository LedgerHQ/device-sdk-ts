import type { IButtonController } from "@internal/core/IButtonController";
import type { ButtonKey } from "@internal/core/types";

export async function pressSequence(
  buttons: IButtonController,
  keys: ButtonKey[],
  delayMs = 200,
): Promise<void> {
  for (const k of keys) {
    await buttons.press(k);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export function pressButtons(buttons: IButtonController): {
  left: () => Promise<void>;
  right: () => Promise<void>;
  both: () => Promise<void>;
} {
  return {
    left: async () => await buttons.press("left"),
    right: async () => await buttons.press("right"),
    both: async () => await buttons.press("both"),
  };
}
