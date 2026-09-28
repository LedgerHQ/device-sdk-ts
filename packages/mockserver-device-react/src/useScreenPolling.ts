import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type DeviceScreenInput,
  type DeviceScreenState,
  type ScreenApi,
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
): DeviceScreenState {
  const [state, setState] = useState<DeviceScreenState>({ kind: "loading" });

  const objectUrl = useRef<string | null>(null);
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

  const releaseObjectUrl = useCallback(() => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  }, []);

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
        releaseObjectUrl();
        objectUrl.current = URL.createObjectURL(blob);
        setState({ kind: "image", src: objectUrl.current, input });
      } else {
        const idle = await api.idle?.();
        if (stale()) return;
        releaseObjectUrl();
        setState(idle ?? { kind: "error", message: "No screen to capture" });
      }
    } catch (error) {
      if (!stale()) fail(error);
    } finally {
      inFlight.current = false;
    }
  }, [api, input, fail, releaseObjectUrl]);
  refreshRef.current = () => void refresh();

  useEffect(() => {
    if (!polling) {
      // Drop the frame rather than keep a revoked object URL around, which
      // would flash a broken image when the panel reopens.
      releaseObjectUrl();
      setState({ kind: "loading" });
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = async () => {
      if (!document.hidden) await refresh();
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
  }, [polling, refresh, releaseObjectUrl]);

  useEffect(() => releaseObjectUrl, [releaseObjectUrl]);

  return state;
}
