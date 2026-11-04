import React, { useCallback, useState } from "react";
import { Button } from "@ledgerhq/lumen-ui-react";
import { ArrowRight } from "@ledgerhq/lumen-ui-react/symbols";

import { Block } from "@/components/Block";
import { Input } from "@/components/fields";
import { type LogEntry, LogPanel } from "@/components/LogPanel";
import { ResizableTextArea } from "@/components/ResizableTextArea";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import {
  buildOnboardApdu,
  checkOnboardStatusWord,
} from "@/utils/onboardDevice";

const WORD_COUNT = 24;

export const OnboardDeviceView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();

  const [pin, setPin] = useState("");
  const [words, setWords] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const handleOnboard = useCallback(async () => {
    const wordCount = words.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount !== WORD_COUNT) {
      setFormError(`Expected ${WORD_COUNT} words, got ${wordCount}`);
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setFormError("PIN must be 4 to 8 digits");
      return;
    }

    setFormError(null);
    setLoading(true);
    setLogs([]);

    try {
      const apdu = buildOnboardApdu({
        identity: 0,
        pin,
        passphrase: passphrase || undefined,
        words: words.trim(),
      });

      setLogs((prev) => [
        ...prev,
        {
          date: new Date(),
          message: "Sending onboard command... this can take a minute.",
          type: "info",
        },
      ]);

      const resp = await dmk.sendApdu({ sessionId, apdu });
      checkOnboardStatusWord(resp.statusCode);

      setLogs((prev) => [
        ...prev,
        {
          date: new Date(),
          message: "Device onboarded successfully.",
          type: "success",
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setLogs((prev) => [
        ...prev,
        { date: new Date(), message, type: "error" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [dmk, sessionId, pin, words, passphrase]);

  return (
    <div className="flex flex-col gap-y-12 p-16" style={{ maxWidth: 600 }}>
      <span className="heading-4-semi-bold">Onboard Device</span>
      <span className="body-2 text-warning">
        This provisions the device directly from a PIN and seed phrase,
        bypassing the on-device onboarding UI — use test seeds only.
      </span>
      <span className="body-2-semi-bold text-warning">
        The device must be in recovery mode before running this. It will fail
        (status word 0x6d07 or 0x660e) on a device that is booted normally,
        whether or not it&rsquo;s already onboarded.
      </span>
      <span className="body-2 text-muted">
        Onboarding can take up to a minute — the device is deriving keys and
        writing to NVRAM. Keep it connected until it completes.
      </span>
      <Block>
        <Input
          id="onboard-pin"
          label="PIN"
          value={pin}
          onChange={(val) => setPin(String(val).replace(/[^0-9]/g, ""))}
          placeholder="4-8 digits"
          disabled={loading}
          data-testid="input_onboard-pin"
        />

        <ResizableTextArea
          value={words}
          onChange={setWords}
          placeholder="24 BIP39 words, separated by spaces"
          disabled={loading}
        />

        <Input
          id="onboard-passphrase"
          label="Derivation passphrase (optional)"
          hint="Optional BIP39 passphrase (the '25th word'). Leave empty unless the seed was meant to be used with one."
          value={passphrase}
          onChange={(val) => setPassphrase(String(val))}
          placeholder="leave empty if none"
          disabled={loading}
        />

        <Button
          appearance="base"
          disabled={loading}
          onClick={handleOnboard}
          icon={ArrowRight}
          loading={loading}
          data-testid="CTA_onboard-device"
        >
          Onboard Device
        </Button>

        {formError && (
          <span
            className="body-2 text-error"
            data-testid="text_onboard-form-error"
          >
            {formError}
          </span>
        )}

        <LogPanel logs={logs} />
      </Block>
    </div>
  );
};
