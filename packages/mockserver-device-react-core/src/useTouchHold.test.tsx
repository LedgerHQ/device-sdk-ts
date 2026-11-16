import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { HOLD_THRESHOLD_MS } from "./useHold";
import { toScreenPoint, type TouchHold, useTouchHold } from "./useTouchHold";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("toScreenPoint", () => {
  const drawn = { width: 200, height: 300 };
  const screen = { width: 400, height: 600 };

  it("scales a point on the drawn screen to device pixels", () => {
    expect(toScreenPoint(50, 150, drawn, screen)).toEqual({ x: 100, y: 300 });
  });

  it("keeps the far edges on the last pixel", () => {
    expect(toScreenPoint(200, 300, drawn, screen)).toEqual({ x: 399, y: 599 });
    expect(toScreenPoint(-5, -5, drawn, screen)).toEqual({ x: 0, y: 0 });
  });

  it("has no point while a size is unknown", () => {
    expect(toScreenPoint(50, 50, { width: 0, height: 0 }, screen)).toBeNull();
    expect(toScreenPoint(50, 50, drawn, { width: 0, height: 0 })).toBeNull();
  });
});

describe("useTouchHold", () => {
  let root: Root;
  let touch: TouchHold;
  const onTouch = vi.fn();

  const Probe: React.FC<{ handler?: typeof onTouch }> = ({ handler }) => {
    touch = useTouchHold(handler);
    return null;
  };
  const render = (handler?: typeof onTouch) =>
    act(() => root.render(<Probe handler={handler} />));

  beforeEach(() => {
    vi.useFakeTimers();
    onTouch.mockReset();
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("sends a quick tap as one press-and-release", () => {
    render(onTouch);

    expect(touch.hold({ x: 10, y: 20 })).toBe(true);
    expect(touch.release()).toBe(true);

    expect(onTouch).toHaveBeenCalledExactlyOnceWith(
      10,
      20,
      "press-and-release",
    );
  });

  it("sends a hold as a press, then a release where the finger went down", () => {
    render(onTouch);

    touch.hold({ x: 10, y: 20 });
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);
    touch.release();

    expect(onTouch.mock.calls).toEqual([
      [10, 20, "press"],
      [10, 20, "release"],
    ]);
  });

  it("ignores a second finger while one is down", () => {
    render(onTouch);
    touch.hold({ x: 10, y: 20 });

    expect(touch.hold({ x: 30, y: 40 })).toBe(false);
    touch.release();
    expect(onTouch).toHaveBeenCalledExactlyOnceWith(
      10,
      20,
      "press-and-release",
    );
  });

  it("ignores touches without a handler", () => {
    render();

    expect(touch.hold({ x: 10, y: 20 })).toBe(false);
    expect(touch.release()).toBe(false);
  });

  it("releases a held finger when unmounted", () => {
    render(onTouch);
    touch.hold({ x: 10, y: 20 });
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);

    act(() => root.unmount());
    root = createRoot(document.createElement("div"));

    expect(onTouch).toHaveBeenLastCalledWith(10, 20, "release");
  });
});
