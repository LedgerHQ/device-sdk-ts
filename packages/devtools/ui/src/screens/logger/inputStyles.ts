export const INPUT_CONTAINER = "relative w-320 min-w-160 shrink";

/**
 * Shared wrapper that provides the bordered box appearance.
 * Can contain the input and additional controls (like search nav buttons).
 */
export const INPUT_WRAPPER =
  "flex h-32 items-center gap-6 overflow-hidden rounded-sm border border-muted-subtle bg-surface px-8 transition-colors hover:border-muted focus-within:border-active";

/**
 * Shared input used in both FilterInput and SearchInput.
 */
export const INPUT =
  "min-w-0 flex-1 bg-transparent font-mono! body-3 text-base outline-none placeholder:text-muted";

/** Small icon button that sits inside an input wrapper. */
export const INPUT_ICON_BUTTON =
  "flex size-24 shrink-0 cursor-pointer items-center justify-center rounded-xs text-muted transition-colors hover:bg-base-transparent-hover hover:text-base disabled:cursor-default disabled:text-disabled disabled:hover:bg-transparent";

export const SHORTCUT_MODIFIER = /Mac|iPhone|iPad/.test(navigator.userAgent)
  ? "⌘"
  : "Ctrl+";

export const SHORTCUT_HINT =
  "rounded-xs border border-muted px-4 font-mono! body-4 text-muted";
