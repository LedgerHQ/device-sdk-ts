import { useState } from "react";
import { type Device } from "@ledgerhq/device-mockserver-client";
import { Banner, Button, Tag, TextInput } from "@ledgerhq/lumen-ui-react";
import { Send } from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import {
  CLOSE_APP_APDU,
  describeResponse,
  ENTER_EARLY_CHECK_APDU,
  EXIT_EARLY_CHECK_APDU,
  GET_APP_AND_VERSION_APDU,
  GET_OS_VERSION_APDU,
  isValidHex,
  openAppApdu,
} from "@/domain/apdu";

interface ConsolePanelProps {
  readonly token: string;
  readonly device: Device;
  readonly onDeviceMayHaveChanged: () => void;
  readonly onError: (message: string) => void;
}

interface Exchange {
  readonly apdu: string;
  readonly response: string;
  readonly at: number;
}

const QUICK_COMMANDS: { label: string; apdu: string }[] = [
  { label: "Get OS version", apdu: GET_OS_VERSION_APDU },
  { label: "Get running app", apdu: GET_APP_AND_VERSION_APDU },
  { label: "Close app", apdu: CLOSE_APP_APDU },
];

export function ConsolePanel({
  token,
  device,
  onDeviceMayHaveChanged,
  onError,
}: ConsolePanelProps) {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async (apdu: string) => {
    setBusy(true);
    try {
      const { response } = await api.sendApdu(token, device.id, apdu);
      setLog((current) =>
        [{ apdu, response, at: Date.now() }, ...current].slice(0, 12),
      );
      onDeviceMayHaveChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const inputValid = input.length > 0 && isValidHex(input);
  const onboarding = device.onboarded === false;

  return (
    <div className="flex flex-col gap-16">
      <p className="body-3 text-muted">
        Send an APDU the way a connected app would, and see exactly what this
        device answers — mocks included.
      </p>

      <div className="flex flex-col gap-8">
        <p className="body-3-semi-bold text-base">Quick commands</p>
        <div className="flex flex-wrap gap-6">
          {QUICK_COMMANDS.map(({ label, apdu }) => (
            <Button
              key={label}
              appearance="gray"
              size="sm"
              onClick={() => void send(apdu)}
            >
              {label}
            </Button>
          ))}
          {(device.apps ?? [])
            .filter((app) => app.name.toUpperCase() !== "BOLOS")
            .map((app) => (
              <Button
                key={app.name}
                appearance="gray"
                size="sm"
                onClick={() => void send(openAppApdu(app.name))}
              >
                {`Open ${app.name}`}
              </Button>
            ))}
        </div>
      </div>

      {onboarding ? (
        <Banner
          appearance="info"
          title="This device is not onboarded"
          description="Send Enter early check, then Exit early check, then poll Get OS version once per step: choose name, PIN, setup choice, new device, confirming, safety warning, ready."
          primaryAction={
            <Button
              appearance="transparent"
              size="sm"
              onClick={() => void send(ENTER_EARLY_CHECK_APDU)}
            >
              Enter early check
            </Button>
          }
          secondaryAction={
            <Button
              appearance="no-background"
              size="sm"
              onClick={() => void send(EXIT_EARLY_CHECK_APDU)}
            >
              Exit early check
            </Button>
          }
        />
      ) : null}

      <form
        className="flex items-start gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (inputValid) void send(input.toLowerCase());
        }}
      >
        <div className="min-w-0 flex-1">
          <TextInput
            label="APDU"
            placeholder="e001000000"
            helperText="Hex, an even number of characters."
            status={input.length > 0 && !inputValid ? "error" : undefined}
            value={input}
            hideClearButton
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
        <Button type="submit" icon={Send} loading={busy} disabled={!inputValid}>
          Send
        </Button>
      </form>

      {log.length > 0 ? (
        <div className="border-muted flex flex-col rounded-md border">
          {log.map((exchange) => {
            const { data, status, label, ok } = describeResponse(
              exchange.response,
            );
            return (
              <div
                key={`${exchange.at}-${exchange.apdu}`}
                className="border-muted flex flex-wrap items-center justify-between gap-8 border-b p-12 last:border-b-0"
              >
                <span className="body-4 text-muted font-mono break-all">
                  {exchange.apdu}
                </span>
                <div className="flex items-center gap-8">
                  {data ? (
                    <span className="body-4 text-base font-mono break-all">
                      {data}
                    </span>
                  ) : null}
                  <Tag
                    size="sm"
                    appearance={ok ? "success" : "error"}
                    label={`${status} · ${label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
