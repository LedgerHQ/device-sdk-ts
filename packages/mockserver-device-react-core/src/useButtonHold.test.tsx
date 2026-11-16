import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { type ButtonHold, useButtonHold } from "./useButtonHold";
import { HOLD_THRESHOLD_MS } from "./useHold";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("useButtonHold", () => {
  let root: Root;
  let buttons: ButtonHold;
  const onPress = vi.fn();

  const Probe: React.FC = () => {
    buttons = useButtonHold(onPress);
    return null;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    onPress.mockReset();
    root = createRoot(document.createElement("div"));
    act(() => root.render(<Probe />));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("sends a quick click as one press-and-release", () => {
    buttons.hold("left");
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS - 1);
    buttons.release();

    expect(onPress).toHaveBeenCalledExactlyOnceWith(
      "left",
      "press-and-release",
    );
  });

  it("sends a hold as a press then a release", () => {
    buttons.hold("both");
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);
    expect(onPress).toHaveBeenCalledExactlyOnceWith("both", "press");

    buttons.release();

    expect(onPress).toHaveBeenLastCalledWith("both", "release");
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("handles one button at a time", () => {
    buttons.hold("left");
    buttons.hold("right");
    buttons.release();

    expect(onPress).toHaveBeenCalledExactlyOnceWith(
      "left",
      "press-and-release",
    );
  });

  it("ignores a release with nothing held", () => {
    buttons.release();

    expect(onPress).not.toHaveBeenCalled();
  });

  it("releases a held button when unmounted", () => {
    buttons.hold("right");
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);

    act(() => root.unmount());
    root = createRoot(document.createElement("div"));

    expect(onPress).toHaveBeenLastCalledWith("right", "release");
  });

  it("sends nothing for a click cut short by an unmount", () => {
    buttons.hold("right");

    act(() => root.unmount());
    root = createRoot(document.createElement("div"));
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);

    expect(onPress).not.toHaveBeenCalled();
  });
});
