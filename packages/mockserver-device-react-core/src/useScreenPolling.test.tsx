import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  type DeviceScreenState,
  type ScreenApi,
  type ScreenPlatform,
} from "./types";
import { useScreenPolling } from "./useScreenPolling";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FRAME = new Blob(["frame"]);

const anApi = (overrides: Partial<ScreenApi> = {}): ScreenApi => ({
  screenshot: vi.fn(() => Promise.resolve(FRAME)),
  pressButton: vi.fn(() => Promise.resolve()),
  touch: vi.fn(() => Promise.resolve()),
  ...overrides,
});

describe("useScreenPolling", () => {
  let container: HTMLDivElement;
  let root: Root;
  let states: DeviceScreenState[];
  let hidden: boolean;
  const toImageSource = vi.fn<ScreenPlatform["toImageSource"]>();
  const releaseImageSource = vi.fn<(source: string) => void>();
  const platform: ScreenPlatform = {
    toImageSource,
    releaseImageSource,
    isHidden: () => hidden,
  };

  const Probe: React.FC<{ api: ScreenApi; polling: boolean }> = ({
    api,
    polling,
  }) => {
    states.push(useScreenPolling(api, polling, platform));
    return null;
  };
  const render = (api: ScreenApi, polling = true) =>
    act(() => root.render(<Probe api={api} polling={polling} />));
  const wait = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
  /**
   * The turn after the first frame comes at the idle pace: the delay is picked
   * before the frame renders. Live turns follow every 500ms.
   */
  const nextTurn = () => wait(2000);
  const latest = () => states[states.length - 1];

  beforeEach(() => {
    vi.useFakeTimers();
    states = [];
    hidden = false;
    let frames = 0;
    toImageSource.mockReset();
    toImageSource.mockImplementation(() =>
      Promise.resolve(`source-${++frames}`),
    );
    releaseImageSource.mockReset();
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("shows a frame through the platform's image source", async () => {
    render(anApi());
    await wait();

    expect(toImageSource).toHaveBeenCalledWith(FRAME);
    expect(latest()).toMatchObject({ kind: "image", src: "source-1" });
  });

  it("releases a frame's source once the next one replaces it", async () => {
    render(anApi());
    await wait();
    await nextTurn();

    expect(latest()).toMatchObject({ kind: "image", src: "source-2" });
    expect(releaseImageSource).toHaveBeenCalledExactlyOnceWith("source-1");
  });

  it("keeps its state while the frame stays the same", async () => {
    toImageSource.mockResolvedValue("data:same");
    render(anApi());
    await wait();
    const frame = latest();

    await nextTurn();
    await wait(500);

    expect(toImageSource).toHaveBeenCalledTimes(3);
    // React may render once more before bailing out, but with the same state:
    // the image never gets a new source to draw.
    const frames = states.filter(({ kind }) => kind === "image");
    expect(new Set(frames)).toEqual(new Set([frame]));
    expect(releaseImageSource).not.toHaveBeenCalled();
  });

  it("releases the source when the app quits", async () => {
    const screenshot = vi
      .fn<ScreenApi["screenshot"]>()
      .mockResolvedValueOnce(FRAME)
      .mockResolvedValue(null);
    render(anApi({ screenshot }));
    await wait();
    await nextTurn();

    expect(latest()).toEqual({
      kind: "error",
      message: "No screen to capture",
    });
    expect(releaseImageSource).toHaveBeenCalledWith("source-1");
  });

  it("releases the source when unmounted", async () => {
    render(anApi());
    await wait();

    act(() => root.unmount());
    root = createRoot(container);

    expect(releaseImageSource).toHaveBeenCalledWith("source-1");
  });

  it("releases a frame made after polling stopped, without showing it", async () => {
    let finish: (source: string) => void = () => {};
    toImageSource.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const api = anApi();
    render(api);
    await wait();

    render(api, false);
    finish("late");
    await wait();

    expect(latest()).toEqual({ kind: "loading" });
    expect(releaseImageSource).toHaveBeenCalledWith("late");
  });

  it("skips its turns while the platform is hidden", async () => {
    hidden = true;
    const api = anApi();
    render(api);
    await wait(10_000);
    expect(api.screenshot).not.toHaveBeenCalled();

    hidden = false;
    await wait(2000);

    expect(api.screenshot).toHaveBeenCalledOnce();
  });
});
