import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  IconButton,
  ListItem,
  ListItemContent,
  ListItemDescription,
  ListItemLeading,
  ListItemTitle,
  ListItemTrailing,
  Spot,
  TextInput,
  Tile,
  TileContent,
  TileDescription,
  TileTitle,
} from "@ledgerhq/lumen-ui-react";
import {
  ChevronRight,
  LedgerLogo,
  Plus,
  RecoveryKey,
  Trash,
} from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import { ServerStatus } from "@/components/ServerStatus";
import {
  forgetSession,
  getKnownSessions,
  type KnownSession,
} from "@/domain/storage";

const STEPS = [
  "A session is a private sandbox. It holds the devices you invent and the canned APDU replies you give them.",
  "Describe your devices — model, firmware, installed apps, onboarded or not — and connect them.",
  "Point Ledger Live or your DMK app at this server with the session token, and it sees exactly those devices.",
];

interface LandingPageProps {
  readonly notice: string | null;
  readonly onEnter: (token: string) => void;
}

export function LandingPage({ notice, onEnter }: LandingPageProps) {
  const [known, setKnown] = useState<KnownSession[]>([]);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setKnown(getKnownSessions()), []);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      onEnter(await action());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const createSession = () =>
    void run(async () => (await api.createSession()).token);

  const openSession = (token: string) =>
    void run(async () => {
      const trimmed = token.trim();
      // Fail here rather than on the session screen if the token is unknown.
      await api.getSession(trimmed);
      return trimmed;
    });

  const forget = (token: string) => {
    forgetSession(token);
    setKnown(getKnownSessions());
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-24 py-64">
      <div className="flex w-full max-w-[640px] flex-col gap-32">
        <header className="flex flex-col items-center gap-12 text-center">
          <LedgerLogo size={40} className="text-base" />
          <h1 className="heading-2 text-base">Device Mock Server</h1>
          <p className="body-2 text-muted">
            Fake Ledger devices over HTTP. Create a session, describe the
            devices you want, and point Ledger Live or a DMK app at it.
          </p>
          <ServerStatus />
        </header>

        {notice ? <Banner appearance="info" description={notice} /> : null}
        {error ? (
          <Banner
            appearance="error"
            title="That did not work"
            description={error}
            onClose={() => setError(null)}
            closeAriaLabel="Dismiss error"
          />
        ) : null}

        <div className="grid grid-cols-1 gap-16 sm:grid-cols-2">
          <Tile
            appearance="card"
            aria-label="Create a new session"
            disabled={busy}
            onClick={createSession}
          >
            <Spot appearance="icon" icon={Plus} />
            <TileContent>
              <TileTitle>Create a session</TileTitle>
              <TileDescription>
                Start from scratch with an empty sandbox.
              </TileDescription>
            </TileContent>
          </Tile>

          <Tile
            appearance="card"
            aria-label="Open an existing session"
            disabled={busy}
            onClick={() => setShowTokenInput(true)}
          >
            <Spot appearance="icon" icon={RecoveryKey} />
            <TileContent>
              <TileTitle>Enter a session</TileTitle>
              <TileDescription>
                Paste a token to pick up a session already in use.
              </TileDescription>
            </TileContent>
          </Tile>
        </div>

        {showTokenInput ? (
          <form
            className="flex flex-col gap-12"
            onSubmit={(event) => {
              event.preventDefault();
              openSession(tokenInput);
            }}
          >
            <TextInput
              label="Session token"
              helperText="The bearer token from POST /auth — Ledger Live and the server logs both show it."
              value={tokenInput}
              autoFocus
              onChange={(event) => setTokenInput(event.target.value)}
            />
            <div className="flex gap-8">
              <Button
                type="submit"
                disabled={tokenInput.trim().length === 0}
                loading={busy}
              >
                Open session
              </Button>
              <Button
                appearance="no-background"
                type="button"
                onClick={() => setShowTokenInput(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {known.length > 0 ? (
          <div className="flex flex-col gap-8">
            <h2 className="heading-5 text-base">Recently used</h2>
            <div className="bg-base border-muted flex flex-col rounded-lg border">
              {known.map((entry) => (
                <ListItem
                  key={entry.token}
                  onClick={() => openSession(entry.token)}
                >
                  <ListItemLeading>
                    <ListItemContent>
                      <ListItemTitle>
                        <span className="font-mono">
                          {entry.token.slice(0, 12)}…
                        </span>
                      </ListItemTitle>
                      <ListItemDescription>
                        Last used {new Date(entry.lastUsedAt).toLocaleString()}
                      </ListItemDescription>
                    </ListItemContent>
                  </ListItemLeading>
                  <ListItemTrailing>
                    <IconButton
                      appearance="no-background"
                      size="sm"
                      aria-label="Forget this token"
                      icon={Trash}
                      onClick={(event) => {
                        event.stopPropagation();
                        forget(entry.token);
                      }}
                    />
                    <ChevronRight size={20} className="text-muted" />
                  </ListItemTrailing>
                </ListItem>
              ))}
            </div>
            <p className="body-4 text-muted">
              Tokens live in this browser only. The server forgets every session
              when it restarts.
            </p>
          </div>
        ) : null}

        <div className="border-muted flex flex-col gap-12 rounded-lg border p-24">
          <h2 className="heading-5 text-base">How it works</h2>
          <ol className="flex flex-col gap-12">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-12">
                <Spot
                  appearance="number"
                  number={(index + 1) as 1 | 2 | 3}
                  size={32}
                />
                <p className="body-3 text-muted pt-6">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
