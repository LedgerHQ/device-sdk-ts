import React, { useState } from "react";
import { Button, TextInput } from "@ledgerhq/lumen-ui-react";
import { ChevronRight } from "@ledgerhq/lumen-ui-react/symbols";

import { type ApduResponse } from "../../hooks/useConnectorMessages";

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
  const [expanded, setExpanded] = useState(false);
  const [apduInput, setApduInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const handleSend = () => {
    if (!apduInput.trim()) return;
    // Remove spaces and validate hex
    const cleanHex = apduInput.replace(/\s/g, "").toUpperCase();
    if (!/^[0-9A-F]*$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
      setInputError("Invalid hex string (e.g., E0C4000000)");
      return;
    }
    const requestId = onSend(sessionId, cleanHex);
    setLastRequestId(requestId);
  };

  const lastResponse = lastRequestId ? responses.get(lastRequestId) : null;

  const formatBytes = (bytes: number[] | undefined): string => {
    if (!bytes || !Array.isArray(bytes)) return "";
    return bytes
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
  };

  return (
    <div className="flex flex-col gap-8 border-t border-muted-subtle pt-12">
      <button
        className="flex cursor-pointer items-center gap-8 body-3-semi-bold text-muted select-none hover:text-base"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        Send APDU
      </button>
      {expanded && (
        <>
          <div className="flex items-start gap-8">
            <TextInput
              className="flex-1"
              placeholder="APDU hex (e.g., E0C4000000)"
              value={apduInput}
              onChange={(e) => {
                setApduInput(e.target.value);
                setInputError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              status={inputError ? "error" : undefined}
              helperText={inputError ?? undefined}
            />
            <Button
              appearance="accent"
              size="lg"
              onClick={handleSend}
              disabled={!apduInput.trim()}
            >
              Send
            </Button>
          </div>
          {lastResponse && (
            <div
              className={`rounded-sm p-8 font-mono! body-3 ${lastResponse.success ? "bg-success-transparent" : "bg-error-transparent"}`}
            >
              {lastResponse.success ? (
                <>
                  {lastResponse.data && lastResponse.data.length > 0 && (
                    <>
                      <span className="font-semibold">Data: </span>
                      <span className="break-all text-muted">
                        {formatBytes(lastResponse.data)}
                      </span>
                      <br />
                    </>
                  )}
                  <span className="font-semibold">Status: </span>
                  <span className="break-all text-muted">
                    {formatBytes(lastResponse.statusCode)}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-error">Error: </span>
                  <span className="break-all text-muted">
                    {lastResponse.error}
                  </span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
