import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DeviceScreenImage } from "./DeviceScreenImage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("DeviceScreenImage", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onTouch = vi.fn();

  const image = () =>
    container.querySelector<HTMLImageElement>(
      '[data-testid="image_device-screen"]',
    )!;
  const render = (touch?: typeof onTouch) =>
    act(() => root.render(<DeviceScreenImage src="blob:1" onTouch={touch} />));
  const pointer = (type: string, init: MouseEventInit = {}) =>
    act(() => {
      image().dispatchEvent(
        new MouseEvent(type, { bubbles: true, button: 0, ...init }),
      );
    });
  /** A 400x600 screen drawn at 200x300 from the page's top left corner. */
  const sizeImage = () => {
    Object.defineProperty(image(), "naturalWidth", { value: 400 });
    Object.defineProperty(image(), "naturalHeight", { value: 600 });
    image().getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 300 }) as DOMRect;
  };

  beforeEach(() => {
    onTouch.mockReset();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("maps a touch to device pixels and releases it where it went down", () => {
    render(onTouch);
    sizeImage();

    pointer("pointerdown", { clientX: 50, clientY: 150 });
    pointer("pointerup", { clientX: 190, clientY: 10 });

    expect(onTouch.mock.calls).toEqual([
      [100, 300, "press"],
      [100, 300, "release"],
    ]);
  });

  it("clamps a touch on the far edge to the last pixel", () => {
    render(onTouch);
    sizeImage();

    pointer("pointerdown", { clientX: 200, clientY: 300 });

    expect(onTouch).toHaveBeenCalledWith(399, 599, "press");
  });

  it("ignores touches before the image has a size", () => {
    render(onTouch);

    pointer("pointerdown", { clientX: 10, clientY: 10 });
    pointer("pointerup");

    expect(onTouch).not.toHaveBeenCalled();
  });

  it("ignores touches on a button-driven device", () => {
    render();
    sizeImage();

    pointer("pointerdown", { clientX: 10, clientY: 10 });

    expect(onTouch).not.toHaveBeenCalled();
  });

  it("releases a held touch when unmounted", () => {
    render(onTouch);
    sizeImage();
    pointer("pointerdown", { clientX: 50, clientY: 150 });

    act(() => root.render(<></>));

    expect(onTouch).toHaveBeenLastCalledWith(100, 300, "release");
  });

  it("says so when the screenshot cannot be decoded", () => {
    render(onTouch);

    act(() => {
      image().dispatchEvent(new Event("error"));
    });

    expect(
      container.querySelector('[data-testid="text_device-screen-undecodable"]'),
    ).not.toBeNull();
  });
});
