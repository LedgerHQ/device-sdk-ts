import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type Session } from "@ledgerhq/device-mockserver-client";

import { useMockClient } from "@/hooks/useMockClient";
import {
  selectMockServerSessionToken,
  selectMockServerUrl,
  selectTransportType,
} from "@/state/settings/selectors";
import { setMockServerSessionToken } from "@/state/settings/slice";

export type MockServerSessionStatus =
  | "disabled"
  | "checking"
  | "active"
  | "none";

export type MockServerSessionState = {
  status: MockServerSessionStatus;
  session: Session | null;
  /** Whether the session token is shared via settings (vs auto-provisioned). */
  shared: boolean;
};

const REFRESH_INTERVAL_MS = 5000;

/**
 * Resolves (and shares) the mock server session used by the mockserver
 * transport.
 *
 * When the mockserver transport is enabled and no session token is configured,
 * a session is provisioned and persisted to settings so the transport and the
 * Mock view operate on the same session (devices added in the UI then appear in
 * device discovery). Returns the current session status for display.
 */
export function useMockServerSession(): MockServerSessionState {
  const transportType = useSelector(selectTransportType);
  const url = useSelector(selectMockServerUrl);
  const token = useSelector(selectMockServerSessionToken);
  const dispatch = useDispatch();
  const client = useMockClient(url, token);

  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<MockServerSessionStatus>("disabled");

  const enabled = transportType === "mockserver";

  useEffect(() => {
    if (!enabled) {
      setStatus("disabled");
      setSession(null);
      return;
    }

    let cancelled = false;

    const ensureAndFetch = async () => {
      try {
        if (!token) {
          // Provision a session once and share it through settings so the
          // transport and the Mock view use the same session.
          const provisioned = await client.authenticate();
          if (cancelled) return;
          dispatch(
            setMockServerSessionToken({ mockServerSessionToken: provisioned }),
          );
          return; // effect re-runs with the new token
        }
        const current = await client.getSession();
        if (cancelled) return;
        setSession(current);
        setStatus("active");
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setSession(null);
        setStatus("none");
      }
    };

    setStatus((prev) => (prev === "active" ? prev : "checking"));
    ensureAndFetch();
    const intervalId = setInterval(ensureAndFetch, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [enabled, token, url, client, dispatch]);

  return { status, session, shared: Boolean(token) };
}
