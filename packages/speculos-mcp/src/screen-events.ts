import { CONFIRM_REJECT_PATTERNS, REJECT_BUTTON_PATTERNS } from "./constants";

export type ScreenEvent = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function formatEvents(events: ScreenEvent[]): string {
  if (events.length === 0) return "(empty screen)";
  return events.map((e) => e.text).join("\n");
}

export function eventsEqual(a: ScreenEvent[], b: ScreenEvent[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ev, i) => ev.text === b[i]!.text);
}

export function findEvent(
  events: ScreenEvent[],
  pattern: RegExp,
): ScreenEvent | undefined {
  return events.find((e) => pattern.test(e.text));
}

export function findRejectButton(
  events: ScreenEvent[],
): ScreenEvent | undefined {
  for (const pattern of REJECT_BUTTON_PATTERNS) {
    const found = findEvent(events, pattern);
    if (found) return found;
  }
  return undefined;
}

export function findConfirmRejectButton(
  events: ScreenEvent[],
): ScreenEvent | undefined {
  for (const pattern of CONFIRM_REJECT_PATTERNS) {
    const found = findEvent(events, pattern);
    if (found) return found;
  }
  return undefined;
}

export function findSignButton(events: ScreenEvent[]): ScreenEvent | undefined {
  return findEvent(events, /hold to/i) ?? findEvent(events, /sign/i);
}
