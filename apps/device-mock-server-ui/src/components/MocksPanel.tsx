import { type ReactNode, useState } from "react";
import { type Mock } from "@ledgerhq/device-mockserver-client";
import { Button, IconButton, TextInput } from "@ledgerhq/lumen-ui-react";
import { PenEdit, Plus, Trash } from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import { MockPresetsDialog } from "@/components/MockPresetsDialog";
import { isValidHex } from "@/domain/apdu";
import { type MockPreset } from "@/domain/mockPresets";

interface MocksPanelProps {
  readonly token: string;
  readonly deviceId: string;
  readonly mocks: Mock[];
  readonly onChanged: () => void;
  readonly onError: (message: string) => void;
}

const parseResponses = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
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

  const addPreset = (preset: MockPreset) => {
    setPresetsOpen(false);
    void run(() =>
      api.addMock(token, deviceId, {
        prefix: preset.prefix,
        responses: preset.responses,
      }),
    );
  };

  const startEdit = (mock: Mock) => {
    setEditingId(mock.id);
    setPrefix(mock.prefix);
    setResponses(mock.responses.join("\n"));
  };

  return (
    <div className="flex flex-col gap-20">
      <section className="flex flex-col gap-8">
        {mocks.length === 0 ? (
          <p className="body-4 text-muted-subtle">
            None — every command gets the server&apos;s own answer.
          </p>
        ) : (
          <div className="flex justify-end">
            <Button
              appearance="no-background"
              size="sm"
              icon={Trash}
              onClick={() => void run(() => api.clearMocks(token, deviceId))}
            >
              Remove all
            </Button>
          </div>
        )}

        {mocks.length === 0 ? null : (
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
      </section>

      <section className="flex flex-col gap-8">
        <Header label={editingId ? "Edit this mock" : "Add a mock"}>
          <Button
            appearance="no-background"
            size="sm"
            onClick={() => setPresetsOpen(true)}
          >
            Common scenarios
          </Button>
        </Header>
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
          A mock answers any APDU starting with its prefix, and beats the answer
          the server would derive; the longest prefix wins. Hex. Several
          responses, comma separated, are served one per call and then loop.
        </p>
      </section>

      {presetsOpen ? (
        <MockPresetsDialog
          onPick={addPreset}
          onClose={() => setPresetsOpen(false)}
        />
      ) : null}
    </div>
  );
}

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
