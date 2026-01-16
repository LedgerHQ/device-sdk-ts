import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  Flex,
  Icons,
  InfiniteLoader,
  Input,
  Text,
} from "@ledgerhq/react-ui";

import { hexStringToUint8Array } from "@/components/ApduView/hexUtils";
import { type ModeProps } from "@/components/ApduView/types";
import { InputLabelWithTooltip } from "@/components/InputLabel";

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
    <Flex flexDirection="column" rowGap={3}>
      <Input
        tabIndex={0}
        name="rawHex"
        renderLeft={() => (
          <InputLabelWithTooltip hint="Enter a raw APDU as a hex string">
            Raw APDU Hex
          </InputLabelWithTooltip>
        )}
        placeholder="E0010000"
        value={rawHexInput}
        onChange={setRawHexInput}
      />

      {validation.error && (
        <Text variant="small" color="error.c80">
          {validation.error}
        </Text>
      )}

      {/* Submit button */}
      <Flex flexDirection="row" justifyContent="flex-end">
        <Button
          variant="main"
          onClick={() => void handleSubmit()}
          disabled={isSubmitDisabled}
          Icon={() =>
            loading ? <InfiniteLoader size={20} /> : <Icons.ArrowRight />
          }
          data-testid="CTA_send-apdu"
        >
          Send
        </Button>
      </Flex>
    </Flex>
  );
};
