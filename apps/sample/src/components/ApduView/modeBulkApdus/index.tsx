import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, Flex, Icons, InfiniteLoader, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { InputHeader } from "@/components/InputHeader";
import { ResizableTextArea } from "@/components/ResizableTextArea";

import { validateBulkInput } from "./inputValidation";

type ModeProps = {
  sendApdu: (apdu: Uint8Array) => Promise<unknown>;
  disabled?: boolean;
};

const PreWrapText = styled(Text)`
  white-space: pre-wrap;
`;

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
    <Flex flexDirection="column" rowGap={3}>
      <Flex flexDirection="column" rowGap={2}>
        <InputHeader hint="Enter one APDU per line. Lines can optionally start with '=>'. Only valid hex strings with even length will be sent.">
          Bulk APDUs
        </InputHeader>
        <ResizableTextArea
          placeholder={`=> E0010000\n=> E0020000\nE0030000`}
          value={bulkInput}
          onChange={setBulkInput}
        />
      </Flex>

      {/* Error/Warning/Info messages */}
      {validation.error && (
        <Text variant="small" color="error.c80">
          {validation.error}
        </Text>
      )}
      {validation.warning && (
        <PreWrapText variant="small" color="warning.c80">
          {validation.warning}
        </PreWrapText>
      )}
      {validation.info && (
        <PreWrapText variant="small" color="neutral.c70">
          {validation.info}
        </PreWrapText>
      )}

      {/* Submit button */}
      <Flex flexDirection="row" justifyContent="flex-end" columnGap={3}>
        {loading && (
          <Button variant="error" outline onClick={handleStop}>
            Stop
          </Button>
        )}
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
