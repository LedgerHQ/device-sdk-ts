import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@ledgerhq/lumen-ui-react";
import { ArrowRight } from "@ledgerhq/lumen-ui-react/symbols";

import { InputHeader } from "@/components/InputHeader";
import { ResizableTextArea } from "@/components/ResizableTextArea";

import { validateBulkInput } from "./inputValidation";

type ModeProps = {
  sendApdu: (apdu: Uint8Array) => Promise<unknown>;
  disabled?: boolean;
};

export const BulkModeInput: React.FC<ModeProps> = ({
  sendApdu,
  disabled = false,
}) => {
  const [bulkInput, setBulkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const stopRef = useRef(false);

  const validation = useMemo(() => validateBulkInput(bulkInput), [bulkInput]);

  const handleSubmit = useCallback(async () => {
    if (!validation.isValid) return;

    const apdusToSend = validation.validApdus;
    stopRef.current = false;
    setLoading(true);
    try {
      for (const apdu of apdusToSend) {
        if (stopRef.current) {
          break;
        }
        await sendApdu(apdu);
      }
    } catch (error) {
      console.error("Error sending APDUs:", error);
    } finally {
      setLoading(false);
      stopRef.current = false;
    }
  }, [validation, sendApdu]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const isSubmitDisabled = disabled || loading || !validation.isValid;

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex flex-col gap-y-4">
        <InputHeader hint="Enter one APDU per line. Lines can optionally start with '=>'. Only valid hex strings with even length will be sent.">
          Bulk APDUs
        </InputHeader>
        <ResizableTextArea
          placeholder={`=> E0010000\n=> E0020000\nE0030000`}
          value={bulkInput}
          onChange={setBulkInput}
        />
      </div>

      {/* Error/Warning/Info messages */}
      {validation.error && (
        <span className="body-3 text-error">{validation.error}</span>
      )}
      {validation.warning && (
        <span className="body-3 text-warning whitespace-pre-wrap">
          {validation.warning}
        </span>
      )}
      {validation.info && (
        <span className="body-3 text-muted whitespace-pre-wrap">
          {validation.info}
        </span>
      )}

      {/* Submit button */}
      <div className="flex flex-row justify-end gap-x-8">
        {loading && (
          <Button appearance="red" onClick={handleStop}>
            Stop
          </Button>
        )}
        <Button
          appearance="base"
          onClick={() => void handleSubmit()}
          disabled={isSubmitDisabled}
          icon={ArrowRight}
          loading={loading}
          data-testid="CTA_send-apdu"
        >
          Send
        </Button>
      </div>
    </div>
  );
};
