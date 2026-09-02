import { type ReactNode, useState } from "react";
import { type Mock } from "@ledgerhq/device-mockserver-client";
import { Button, IconButton, TextInput } from "@ledgerhq/lumen-ui-react";
import { PenEdit, Plus, Trash } from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import { isValidHex } from "@/domain/apdu";
import { MOCK_PRESETS } from "@/domain/mockPresets";

interface MocksPanelProps {
  readonly token: string;
  readonly deviceId: string;
  /** The device's mocks, owned by the card so it can show their count. */
  readonly mocks: Mock[];
  readonly onChanged: () => void;
  readonly onError: (message: string) => void;
}

/** Split the responses field: one per line, or comma separated. */
const parseResponses = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

/**
 * The form opens on a working example — a locked device — so adding a first
 * mock is one click, and the shape of prefix and response is visible at a
 * glance.
 */
const EXAMPLE_PREFIX = "b001";
const EXAMPLE_RESPONSES = "5515";

export function MocksPanel({
  token,
  deviceId,
  mocks,
  onChanged,
  onError,
}: MocksPanelProps) {
  const [prefix, setPrefix] = useState(EXAMPLE_PREFIX);
  const [responses, setResponses] = useState(EXAMPLE_RESPONSES);
  /** Id of the mock being edited, or null when the form adds a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setPrefix(EXAMPLE_PREFIX);
    setResponses(EXAMPLE_RESPONSES);
  };

  const parsed = parseResponses(responses);
  const prefixValid = prefix.length > 0 && isValidHex(prefix);
  const responsesValid =
    parsed.length > 0 && parsed.every((entry) => isValidHex(entry));

  const submit = () =>
    void run(async () => {
      const config = { prefix: prefix.toLowerCase(), responses: parsed };
      if (editingId) await api.editMock(token, deviceId, editingId, config);
      else await api.addMock(token, deviceId, config);
      resetForm();
    });

  const startEdit = (mock: Mock) => {
    setEditingId(mock.id);
    setPrefix(mock.prefix);
    setResponses(mock.responses.join("\n"));
  };

  return (
    <div className="flex flex-col gap-20">
      <section className="flex flex-col gap-8">
        <Header label={`Mocks on this device (${mocks.length})`}>
          {mocks.length > 0 ? (
            <Button
              appearance="no-background"
              size="sm"
              icon={Trash}
              onClick={() => void run(() => api.clearMocks(token, deviceId))}
            >
              Remove all
            </Button>
          ) : null}
        </Header>

        {mocks.length === 0 ? (
          <p className="body-4 text-muted-subtle">
            None yet. The device answers the handshake on its own; add a mock to
            override a command or force a failure.
          </p>
        ) : (
          <div className="border-muted overflow-hidden rounded-md border">
            <div className="bg-muted-transparent border-muted flex items-center gap-12 border-b px-12 py-6">
              <span className="body-4 text-muted w-96 shrink-0">Prefix</span>
              <span className="body-4 text-muted flex-1">Responses</span>
              <span className="w-64 shrink-0" />
            </div>
            {mocks.map((mock) => (
              <div
                key={mock.id}
                className={`border-muted flex items-center gap-12 border-b px-12 py-8 last:border-b-0 ${
                  editingId === mock.id ? "bg-muted-transparent" : ""
                }`}
              >
                <span className="body-3 text-base w-96 shrink-0 font-mono">
                  {mock.prefix}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-6">
                  {mock.responses.map((response, index) => (
                    <span
                      key={`${index}-${response}`}
                      className="bg-muted body-4 text-base rounded-xs px-6 py-2 font-mono"
                    >
                      {response}
                    </span>
                  ))}
                  {mock.responses.length > 1 ? (
                    <span className="body-4 text-muted-subtle">in turn</span>
                  ) : null}
                </div>
                <div className="flex w-64 shrink-0 justify-end">
                  <IconButton
                    appearance="no-background"
                    size="sm"
                    aria-label={`Edit mock ${mock.prefix}`}
                    icon={PenEdit}
                    onClick={() => startEdit(mock)}
                  />
                  <IconButton
                    appearance="no-background"
                    size="sm"
                    aria-label={`Delete mock ${mock.prefix}`}
                    icon={Trash}
                    onClick={() =>
                      void run(() => api.deleteMock(token, deviceId, mock.id))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="body-4 text-muted-subtle">
          A mock answers any APDU starting with its prefix, and beats the answer
          the server would derive. Longest prefix wins.
        </p>
      </section>

      <section className="flex flex-col gap-8">
        <Header label={editingId ? "Edit this mock" : "Add a mock"} />
        <div className="flex flex-col items-start gap-8 sm:flex-row">
          <div className="w-full sm:w-160">
            <TextInput
              label="Prefix"
              placeholder="b001"
              status={prefix.length > 0 && !prefixValid ? "error" : undefined}
              value={prefix}
              hideClearButton
              onChange={(event) => setPrefix(event.target.value)}
            />
          </div>
          <div className="min-w-0 w-full flex-1">
            <TextInput
              label="Responses"
              placeholder="9000, 6807"
              status={
                responses.length > 0 && !responsesValid ? "error" : undefined
              }
              value={responses}
              hideClearButton
              onChange={(event) => setResponses(event.target.value)}
            />
          </div>
          <Button
            size="sm"
            icon={editingId ? undefined : Plus}
            loading={busy}
            disabled={!prefixValid || !responsesValid}
            onClick={submit}
          >
            {editingId ? "Save" : "Add"}
          </Button>
          {editingId ? (
            <Button appearance="no-background" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
        <p className="body-4 text-muted-subtle">
          Hex. Several responses, comma separated, are served one per call and
          then loop.
        </p>
      </section>

      <section className="flex flex-col gap-8">
        <Header label="Common scenarios" />
        <div className="border-muted overflow-hidden rounded-md border">
          {MOCK_PRESETS.map((preset) => (
            <div
              key={preset.label}
              className="border-muted flex items-center gap-12 border-b px-12 py-8 last:border-b-0"
            >
              <span className="body-3 text-base min-w-0 flex-1">
                {preset.label}
              </span>
              <span className="body-4 text-muted shrink-0 font-mono">
                {`${preset.prefix} → ${preset.responses.join(", ")}`}
              </span>
              <Button
                appearance="gray"
                size="sm"
                onClick={() =>
                  void run(() =>
                    api.addMock(token, deviceId, {
                      prefix: preset.prefix,
                      responses: preset.responses,
                    }),
                  )
                }
              >
                Add
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** A small section title, with room for one action on the right. */
function Header({
  label,
  children,
}: {
  readonly label: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-12">
      <p className="body-3-semi-bold text-base">{label}</p>
      {children}
    </div>
  );
}
