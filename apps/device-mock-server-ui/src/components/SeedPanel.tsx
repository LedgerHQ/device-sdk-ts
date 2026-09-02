import { useState } from "react";
import { Banner, Button, TextInput } from "@ledgerhq/lumen-ui-react";

import { api } from "@/api/client";
import { Panel } from "@/components/Panel";

interface SeedPanelProps {
  readonly token: string;
  readonly onError: (message: string) => void;
}

/**
 * The BIP39 mnemonic handed to Speculos when a device in this session opens an
 * app. Only relevant when the server proxies to a real emulator.
 */
export function SeedPanel({ token, onError }: SeedPanelProps) {
  const [seed, setSeed] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await api.setSeed(token, seed.trim());
      setSaved(true);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Speculos seed"
      description="The mnemonic the emulator derives addresses from when a device in this session opens an app. Sessions start on the well-known test seed."
    >
      <div className="flex flex-col gap-12">
        <Banner
          appearance="warning"
          title="Test mnemonics only"
          description="The seed is stored in plain text in server memory and sent over plain HTTP. Never enter a real recovery phrase."
        />
        <div className="flex flex-col items-start gap-8 sm:flex-row">
          <div className="min-w-0 flex-1">
            <TextInput
              label="BIP39 mnemonic"
              placeholder="abandon abandon abandon … about"
              helperText="Leave empty to keep the current seed."
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
          </div>
          <Button
            loading={busy}
            disabled={seed.trim().length === 0}
            onClick={() => void save()}
          >
            Set seed
          </Button>
        </div>
        {saved ? (
          <span className="body-4 text-success">
            Seed updated for this session.
          </span>
        ) : null}
      </div>
    </Panel>
  );
}
