import React, { useState } from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { Send } from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "../../components/WithTooltip";
import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { INPUT, INPUT_WRAPPER } from "../logger/inputStyles";

const PRESETS = [
  { label: "Get app & version", apdu: "B001000000" },
  { label: "Get OS version", apdu: "E001000000" },
];

type ApduSenderProps = {
  sessionId: string;
  onSend: (sessionId: string, apduHex: string) => string;
  responses: Map<string, ApduResponse>;
};

export const ApduSender: React.FC<ApduSenderProps> = ({
  sessionId,
  onSend,
  responses,
}) => {
  const [apduInput, setApduInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const send = (apdu: string) => {
    // Remove spaces and validate hex
    const cleanHex = apdu.replace(/\s/g, "").toUpperCase();
    if (!/^[0-9A-F]*$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
      setInputError("Invalid hex string (e.g., E0C4000000)");
      return;
    }
    setLastRequestId(onSend(sessionId, cleanHex));
  };

  const lastResponse = lastRequestId ? responses.get(lastRequestId) : null;
  const error =
    inputError ??
    (lastResponse && !lastResponse.success ? lastResponse.error : null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-8">
        <span className="flex-1 body-4-semi-bold text-muted uppercase">
          APDU
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.apdu}
            type="button"
            onClick={() => {
              setApduInput(preset.apdu);
              setInputError(null);
              send(preset.apdu);
            }}
            className="cursor-pointer rounded-full bg-muted-transparent px-8 py-2 body-4 text-base hover:bg-muted-transparent-hover"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex gap-8">
        <div className={`flex-1 ${INPUT_WRAPPER}`}>
          <input
            className={INPUT}
            type="text"
            placeholder="APDU hex (e.g., E0C4000000)"
            aria-label="APDU to send"
            value={apduInput}
            onChange={(e) => {
              setApduInput(e.target.value);
              setInputError(null);
            }}
            onKeyDown={(e) =>
              e.key === "Enter" && apduInput.trim() && send(apduInput)
            }
          />
        </div>
        <WithTooltip label="Send APDU">
          <IconButton
            aria-label="Send APDU"
            icon={Send}
            size="xs"
            appearance="transparent"
            className="rounded-sm [&>svg]:text-active"
            onClick={() => send(apduInput)}
            disabled={!apduInput.trim()}
          />
        </WithTooltip>
      </div>
      {error && <p className="body-3 text-error">{error}</p>}
    </div>
  );
};
