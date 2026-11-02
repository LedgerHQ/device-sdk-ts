import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type DeviceScreenInput,
  type DeviceScreenState,
  type ScreenApi,
  type ScreenPlatform,
} from "./types";

const SCREEN_POLL_MS = 500;
const IDLE_POLL_MS = 2000;
/**
 * An app quitting fails a few calls while Speculos shuts down; the last frame
 * stays up through them rather than flashing an error before the dashboard.
 */
const LIVE_FAILURES_TOLERATED = 3;

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function useScreenPolling(
  api: ScreenApi,
  polling: boolean,
  platform: ScreenPlatform,
): DeviceScreenState {
  const [state, setState] = useState<DeviceScreenState>({ kind: "loading" });

  const imageSource = useRef<string | null>(null);
  const inFlight = useRef(false);
  const isLive = useRef(false);
  isLive.current = state.kind === "image";
  const liveFailures = useRef(0);
  /** Bumped when polling stops, so a response still in flight is dropped. */
  const generation = useRef(0);

  const fail = useCallback((error: unknown) => {
    if (isLive.current && ++liveFailures.current <= LIVE_FAILURES_TOLERATED) {
      return;
    }
    setState({ kind: "error", message: describe(error) });
  }, []);

  const releaseImageSource = useCallback(() => {
    if (imageSource.current) {
      platform.releaseImageSource?.(imageSource.current);
      imageSource.current = null;
    }
  }, [platform]);

  /**
   * Input handlers refresh straight after acting. Going through a ref keeps
   * them stable, so the <img> is not remounted on every poll.
   */
  const refreshRef = useRef<() => void>(() => {});

  const input = useMemo<DeviceScreenInput>(() => {
    const send = (call: Promise<void>) =>
      void call.then(() => refreshRef.current()).catch(fail);

    return {
      pressButton: (button, action) => send(api.pressButton(button, action)),
      touch: (x, y, action) => send(api.touch(x, y, action)),
    };
  }, [api, fail]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const started = generation.current;
    const stale = () => started !== generation.current;
    try {
      const blob = await api.screenshot();
      if (stale()) return;
      liveFailures.current = 0;
      if (blob) {
        const source = await platform.toImageSource(blob);
        if (stale()) {
          platform.releaseImageSource?.(source);
          return;
        }
        if (source !== imageSource.current) {
          releaseImageSource();
          imageSource.current = source;
        }
        // A source made from the bytes, like a data URI, repeats while the
        // screen holds still; keeping the state then skips a re-render.
        setState((current) =>
          current.kind === "image" &&
          current.src === source &&
          current.input === input
            ? current
            : { kind: "image", src: source, input },
        );
      } else {
        const idle = await api.idle?.();
        if (stale()) return;
        releaseImageSource();
        setState(idle ?? { kind: "error", message: "No screen to capture" });
      }
    } catch (error) {
      if (!stale()) fail(error);
    } finally {
      inFlight.current = false;
    }
  }, [api, platform, input, fail, releaseImageSource]);
  refreshRef.current = () => void refresh();

  useEffect(() => {
    if (!polling) {
      // Drop the frame rather than keep a released source around, which
      // would flash a broken image when the panel reopens.
      releaseImageSource();
      setState({ kind: "loading" });
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = async () => {
      if (!platform.isHidden()) await refresh();
      if (cancelled) return;
      timer = setTimeout(
        () => void tick(),
        isLive.current ? SCREEN_POLL_MS : IDLE_POLL_MS,
      );
    };
    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      generation.current++;
    };
  }, [polling, platform, refresh, releaseImageSource]);

  useEffect(() => releaseImageSource, [releaseImageSource]);

  return state;
}
