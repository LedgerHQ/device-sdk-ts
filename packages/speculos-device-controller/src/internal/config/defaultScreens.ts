export const DEFAULT_SCREENS = {
  flex: { width: 240, height: 240 },
  stax: { width: 340, height: 340 },
} as const;

export type DefaultDeviceKey = keyof typeof DEFAULT_SCREENS & string;
