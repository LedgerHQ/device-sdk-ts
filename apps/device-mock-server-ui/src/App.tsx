import { useCallback, useEffect, useState } from "react";
import { Spinner, ThemeProvider } from "@ledgerhq/lumen-ui-react";

import { api, MockServerError } from "@/api/client";
import {
  getActiveToken,
  rememberSession,
  setActiveToken,
} from "@/domain/storage";
import { LandingPage } from "@/pages/LandingPage";
import { SessionPage } from "@/pages/SessionPage";

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  // A remembered token dies with the server that issued it, so check it first.
  useEffect(() => {
    const stored = getActiveToken();
    if (!stored) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    api
      .getSession(stored)
      .then(() => {
        if (!cancelled) setToken(stored);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setActiveToken(null);
        setRestoreNotice(
          error instanceof MockServerError && error.status === 401
            ? "Your last session has expired — the server no longer knows that token."
            : "Could not reach the mock server to restore your last session.",
        );
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enterSession = useCallback((next: string) => {
    setActiveToken(next);
    rememberSession(next);
    setRestoreNotice(null);
    setToken(next);
  }, []);

  const leaveSession = useCallback(() => {
    setActiveToken(null);
    setToken(null);
  }, []);

  return (
    <ThemeProvider colorScheme="system">
      <div className="bg-canvas text-base min-h-full">
        {restoring ? (
          <div className="flex min-h-screen items-center justify-center">
            <Spinner size={32} />
          </div>
        ) : token ? (
          <SessionPage
            token={token}
            onLeave={leaveSession}
            onSwitch={enterSession}
          />
        ) : (
          <LandingPage notice={restoreNotice} onEnter={enterSession} />
        )}
      </div>
    </ThemeProvider>
  );
}
