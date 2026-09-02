import { useRef, useState } from "react";
import { type SessionExport } from "@ledgerhq/device-mockserver-client";
import { Banner, Button } from "@ledgerhq/lumen-ui-react";
import { Download, Upload } from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import { Panel } from "@/components/Panel";

interface TransferPanelProps {
  readonly token: string;
  readonly onImported: () => void;
  readonly onError: (message: string) => void;
}

/**
 * Save the whole session (devices with their mocks) to a JSON file and load one
 * back, so a scenario can be committed to a repo or handed to a teammate.
 */
export function TransferPanel({
  token,
  onImported,
  onError,
}: TransferPanelProps) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<string | null>(null);
  const filePicker = useRef<HTMLInputElement>(null);

  const fail = (cause: unknown) =>
    onError(cause instanceof Error ? cause.message : String(cause));

  const download = async () => {
    setBusy(true);
    try {
      const snapshot = await api.exportSession(token);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(snapshot, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "mock-session.json";
      link.click();
      URL.revokeObjectURL(url);
      setDraft(JSON.stringify(snapshot, null, 2));
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const importSnapshot = async (raw: string) => {
    setBusy(true);
    setImported(null);
    try {
      const snapshot = JSON.parse(raw) as SessionExport;
      const result = await api.importSession(token, snapshot);
      setImported(
        `Imported ${result.devices.length} device${
          result.devices.length === 1 ? "" : "s"
        }.`,
      );
      onImported();
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    file
      .text()
      .then((raw) => {
        setDraft(raw);
        return importSnapshot(raw);
      })
      .catch(fail);
  };

  return (
    <Panel
      title="Save and load a session"
      description="A snapshot holds every device and its mocks — no ids, no connection state — so importing it recreates the same setup anywhere."
    >
      <div className="flex flex-col gap-16">
        <div className="flex flex-wrap gap-8">
          <Button
            appearance="gray"
            icon={Download}
            loading={busy}
            onClick={() => void download()}
          >
            Export to a file
          </Button>
          <Button
            appearance="gray"
            icon={Upload}
            onClick={() => filePicker.current?.click()}
          >
            Import from a file
          </Button>
          <input
            ref={filePicker}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
        </div>

        <Banner
          appearance="warning"
          description="Importing replaces every device in this session. Export first if you want to keep the current one."
        />

        <label className="flex flex-col gap-6">
          <span className="body-3-semi-bold text-base">
            Or paste a snapshot
          </span>
          <textarea
            className="border-muted bg-canvas text-base body-4 min-h-160 rounded-md border p-12 font-mono"
            placeholder='{ "devices": [ … ] }'
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center gap-8">
          <Button
            loading={busy}
            disabled={draft.trim().length === 0}
            onClick={() => void importSnapshot(draft)}
          >
            Import this snapshot
          </Button>
          {imported ? (
            <span className="body-4 text-success">{imported}</span>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
