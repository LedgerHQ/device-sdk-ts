import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@ledgerhq/lumen-ui-react";
import { ArrowRight } from "@ledgerhq/lumen-ui-react/symbols";

import { hexStringToUint8Array } from "@/components/ApduView/hexUtils";
import { type ModeProps } from "@/components/ApduView/types";
import { Input } from "@/components/fields";

import { validateRawHexInput } from "./inputValidation";

export const RawHexModeInput: React.FC<ModeProps> = ({
  sendApdu,
  disabled = false,
}) => {
  const [rawHexInput, setRawHexInput] = useState("E001000000");
  const [loading, setLoading] = useState(false);

  const validation = useMemo(
    () => validateRawHexInput(rawHexInput),
    [rawHexInput],
  );

  const handleSubmit = useCallback(async () => {
    if (!validation.isValid) return;

    setLoading(true);
    try {
      const rawApdu = hexStringToUint8Array(rawHexInput);
      await sendApdu(rawApdu);
    } catch (error) {
      console.error("Error sending APDU:", error);
    } finally {
      setLoading(false);
    }
  }, [rawHexInput, validation.isValid, sendApdu]);

  const isSubmitDisabled = disabled || loading || !validation.isValid;

  return (
    <div className="flex flex-col gap-y-8">
      <Input
        tabIndex={0}
        name="rawHex"
        label="Raw APDU Hex"
        hint="Enter a raw APDU as a hex string"
        placeholder="E0010000"
        value={rawHexInput}
        onChange={setRawHexInput}
      />

      {validation.error && (
        <span className="body-3 text-error">{validation.error}</span>
      )}

      {/* Submit button */}
      <div className="flex flex-row justify-end">
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
