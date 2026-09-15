import { type ScreenEvent } from "@root/src/domain/models/ScreenContent";

export const DEVICE_SCREEN_SIZE: Record<
  string,
  { width: number; height: number }
> = {
  stax: { width: 400, height: 672 },
  flex: { width: 480, height: 600 },
  apex: { width: 480, height: 600 },
};

// Only enabled in debug mode.
export const logScreenContents = (
  events: ScreenEvent[],
  device: string,
  label = "screen",
): void => {
  if (events.length === 0) {
    console.log(`[${label}] (no screen text captured)`);
    return;
  }

  const size = DEVICE_SCREEN_SIZE[device];
  console.log(`[${label}] screen contents:`);
  console.table(
    events.map((event) => ({
      text: event.text,
      x: event.x,
      y: event.y,
      w: event.w,
      h: event.h,
      ...(size
        ? {
            "center%": `${(((event.x + event.w / 2) / size.width) * 100).toFixed(1)},${(((event.y + event.h / 2) / size.height) * 100).toFixed(1)}`,
          }
        : {}),
    })),
  );
};
