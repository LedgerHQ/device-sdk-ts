export type ButtonKey = "Ll" | "Rr" | "LRlr" | "left" | "right" | "both";

export type ScreenSpec = Readonly<{ width: number; height: number }>;

export type DeviceScreens<K extends string = string> = Readonly<
  Record<K, ScreenSpec>
>;

export type Range<
  N extends number,
  Acc extends number[] = [],
> = Acc["length"] extends N ? Acc[number] : Range<N, [...Acc, Acc["length"]]>;
export type Percent = Range<101>;

export type PercentPoint = { x: Percent; y: Percent };

export type DeviceControllerOptions<K extends string = string> = {
  timeoutMs?: number;
  clientHeader?: string;
  screens: DeviceScreens<K>;
};
