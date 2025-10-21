import type { ButtonController } from "@internal/core/ButtonController";
import type { ButtonKey } from "@internal/core/types";

const DEFAULT_DELAY_MS = 200;

export async function pressSequence(
  buttons: ButtonController,
  keys: ButtonKey[],
  delayMs = DEFAULT_DELAY_MS,
): Promise<void> {
  for (const k of keys) {
    await buttons.press(k);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export function pressButtons(buttons: ButtonController): {
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
