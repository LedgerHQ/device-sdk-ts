import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DeviceScreenButtons } from "./DeviceScreenButtons";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("DeviceScreenButtons", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onPress = vi.fn();

  const button = (name: string) =>
    container.querySelector<HTMLButtonElement>(
      `[data-testid="button_device-screen-${name}"]`,
    )!;
  const pointer = (target: Element, type: string, init: MouseEventInit = {}) =>
    act(() => {
      target.dispatchEvent(
        new MouseEvent(type, { bubbles: true, button: 0, ...init }),
      );
    });
  const key = (target: Element, type: string, value: string) =>
    act(() => {
      target.dispatchEvent(
        new KeyboardEvent(type, { bubbles: true, key: value }),
      );
    });

  beforeEach(() => {
    vi.useFakeTimers();
    onPress.mockReset();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<DeviceScreenButtons onPress={onPress} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("sends a quick click as one press-and-release", () => {
    pointer(button("left"), "pointerdown");
    pointer(button("left"), "pointerup");

    expect(onPress).toHaveBeenCalledOnce();
    expect(onPress).toHaveBeenCalledWith("left", "press-and-release");
  });

  it("sends a hold as a press then a release", () => {
    pointer(button("both"), "pointerdown");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    pointer(button("both"), "pointerup");

    expect(onPress.mock.calls).toEqual([
      ["both", "press"],
      ["both", "release"],
    ]);
  });

  it("ignores buttons other than the main one", () => {
    pointer(button("right"), "pointerdown", { button: 2 });
    pointer(button("right"), "pointerup", { button: 2 });

    expect(onPress).not.toHaveBeenCalled();
  });

  it("handles one button at a time", () => {
    pointer(button("left"), "pointerdown");
    pointer(button("right"), "pointerdown");
    pointer(button("left"), "pointerup");

    expect(onPress).toHaveBeenCalledWith("left", "press-and-release");
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("drives the buttons from the keyboard", () => {
    key(button("right"), "keydown", "Enter");
    key(button("right"), "keyup", "Enter");
    key(button("right"), "keydown", "a");

    expect(onPress).toHaveBeenCalledOnce();
    expect(onPress).toHaveBeenCalledWith("right", "press-and-release");
  });

  it("releases a held button when unmounted", () => {
    pointer(button("left"), "pointerdown");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => root.render(<></>));

    expect(onPress).toHaveBeenLastCalledWith("left", "release");
  });
});
