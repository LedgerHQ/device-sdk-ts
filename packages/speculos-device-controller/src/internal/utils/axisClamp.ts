import type { DeviceScreens, Percent } from "@internal/core/types";

const clamp = (pct: number) => Math.max(0, Math.min(100, pct)) / 100;

export const clampValue = (value: number) => (pct: Percent) =>
  Math.floor(value * clamp(pct));

export const createAxis = (width: number, height: number) => ({
  vw: clampValue(width),
  vh: clampValue(height),
  xy: (xPct: Percent, yPct: Percent) => ({
    x: clampValue(width)(xPct),
    y: clampValue(height)(yPct),
  }),
});

export type Axis = ReturnType<typeof createAxis>;
export type AxisMap<K extends string = string> = Record<K, Axis>;

export const createAxes = <K extends string>(
  screens: DeviceScreens<K>,
): AxisMap<K> => {
  const mappedAxes = {} as AxisMap<K>;
  for (const key of Object.keys(screens) as K[]) {
    const screen = screens[key];
    mappedAxes[key] = createAxis(screen.width, screen.height);
  }
  return mappedAxes;
};
