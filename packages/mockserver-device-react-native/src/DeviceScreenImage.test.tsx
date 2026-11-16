import React, { act } from "react";
import {
  findDeviceScreenModel,
  HOLD_THRESHOLD_MS,
} from "@ledgerhq/device-mockserver-react-core";

import { aPngDataUri } from "./__tests__/png";
import { fire, invoke, render } from "./__tests__/render";
import { DeviceScreenImage } from "./DeviceScreenImage";

const PALETTE = {
  text: "text",
  mutedText: "muted",
  border: "border",
  button: "button",
  buttonPressed: "pressed",
  error: "error",
};

describe("DeviceScreenImage", () => {
  const onTouch = vi.fn();

  const image = (src: string, touch?: typeof onTouch) => (
    <DeviceScreenImage
      src={src}
      model={findDeviceScreenModel("flex")}
      palette={PALETTE}
      onTouch={touch}
    />
  );

  beforeEach(() => {
    vi.useFakeTimers();
    onTouch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const aspectRatio = (rendered: ReturnType<typeof render>) =>
    (rendered.byTestId("image_device-screen").props["style"] as object[])[1];

  it("draws at the frame's own proportions", () => {
    expect(aspectRatio(render(image(aPngDataUri(300, 600))))).toEqual({
      aspectRatio: 0.5,
    });
  });

  it("draws an unreadable frame at the model's proportions", () => {
    expect(aspectRatio(render(image("data:1")))).toEqual({
      aspectRatio: 480 / 600,
    });
  });

  it("sends a touch in the frame's pixels, however it is drawn", () => {
    const { byTestId } = render(image(aPngDataUri(400, 672), onTouch));
    const area = byTestId("area_device-screen-touch");
    fire(area, "onLayout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 336 } },
    });

    fire(area, "onResponderGrant", {
      nativeEvent: { locationX: 50, locationY: 300 },
    });
    fire(area, "onResponderRelease");

    expect(onTouch).toHaveBeenCalledWith(100, 600, "press-and-release");
  });

  it("does not take the finger without a touch handler", () => {
    const { byTestId } = render(image("data:1"));

    expect(
      invoke(byTestId("area_device-screen-touch"), "onStartShouldSetResponder"),
    ).toBe(false);
  });

  it("keeps a hold from being taken over", () => {
    const { byTestId } = render(image("data:1", onTouch));

    expect(
      invoke(
        byTestId("area_device-screen-touch"),
        "onResponderTerminationRequest",
      ),
    ).toBe(false);
  });

  it("releases the finger when the gesture is taken anyway", () => {
    const { byTestId } = render(image("data:1", onTouch));
    const area = byTestId("area_device-screen-touch");
    fire(area, "onLayout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 480, height: 600 } },
    });

    fire(area, "onResponderGrant", {
      nativeEvent: { locationX: 10, locationY: 20 },
    });
    act(() => {
      vi.advanceTimersByTime(HOLD_THRESHOLD_MS);
    });
    fire(area, "onResponderTerminate");

    expect(onTouch.mock.calls).toEqual([
      [10, 20, "press"],
      [10, 20, "release"],
    ]);
  });

  it("ignores a touch before the screen is laid out", () => {
    const { byTestId } = render(image("data:1", onTouch));

    fire(byTestId("area_device-screen-touch"), "onResponderGrant", {
      nativeEvent: { locationX: 10, locationY: 20 },
    });

    expect(onTouch).not.toHaveBeenCalled();
  });

  it("says when a frame cannot be decoded, until the next one", () => {
    const { byTestId, queryByTestId, rerender } = render(image("data:1"));

    fire(byTestId("image_device-screen"), "onError");
    expect(queryByTestId("text_device-screen-undecodable")).not.toBeNull();

    rerender(image("data:2"));
    expect(queryByTestId("image_device-screen")).not.toBeNull();
  });
});
