/**
 * Shared container for filter and search inputs.
 * Uses flex: 1 to share available width.
 */
export const INPUT_CONTAINER = "relative min-w-160 flex-1";

/**
 * Shared wrapper that provides the bordered box appearance.
 * Can contain the input and additional controls (like search nav buttons).
 */
export const INPUT_WRAPPER =
  "flex h-32 items-center overflow-hidden rounded-sm bg-muted transition-colors hover:bg-muted-hover focus-within:ring-2 focus-within:ring-active";

/**
 * Shared input used in both FilterInput and SearchInput.
 */
export const INPUT =
  "min-w-0 flex-1 bg-transparent px-10 font-mono! body-3 text-base outline-none placeholder:text-muted-subtle";

/** Small icon button that sits inside an input wrapper. */
export const INPUT_ICON_BUTTON =
  "flex h-full shrink-0 cursor-pointer items-center justify-center px-6 text-muted transition-colors hover:bg-muted-transparent-hover hover:text-base disabled:cursor-default disabled:text-disabled disabled:hover:bg-transparent";
