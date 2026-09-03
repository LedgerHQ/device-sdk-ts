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

/**
 * A token handed over in the URL fragment, as `#token=…`, by whoever already
 * holds one — Ledger Live's mock server indicator, a script, a shared link.
 * The fragment is read once and wiped from the address bar; a fragment never
 * reaches the server, so the token stays out of its logs.
 */
const tokenFromFragment = (): string | null => {
  const token = new URLSearchParams(window.location.hash.slice(1))
    .get("token")
    ?.trim();
  if (!token) return null;
  window.history.replaceState(null, "", window.location.pathname);
  return token;
};

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  // A remembered token dies with the server that issued it, so check it first.
  useEffect(() => {
    const handedOver = tokenFromFragment();
    if (handedOver) setActiveToken(handedOver);
    const stored = getActiveToken();
    if (!stored) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    api
      .getSession(stored)
      .then(() => {
        if (cancelled) return;
        rememberSession(stored);
        setToken(stored);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setActiveToken(null);
        setRestoreNotice(
          error instanceof MockServerError && error.status === 401
            ? handedOver
              ? "That session token is not one this server knows — it may have restarted since."
              : "Your last session has expired — the server no longer knows that token."
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
