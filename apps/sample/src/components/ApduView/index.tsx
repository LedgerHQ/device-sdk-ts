import React, { useCallback, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SimpleTooltip } from "@/components/SimpleTooltip";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

import { ApduHistory } from "./ApduHistory";
import { type ApduHistoryItem } from "./ApduResponseView";
import { BuilderModeInput } from "./modeApduBuilder";
import { ResponseParserModeInput } from "./modeApduResponseParser";
import { BulkModeInput } from "./modeBulkApdus";
import { RawHexModeInput } from "./modeRawApdu";

type InputMode = "builder" | "raw" | "bulk" | "parser";

const ModeChip = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary.c80 : theme.colors.neutral.c40};
  background-color: ${({ theme, $active }) =>
    $active ? theme.colors.primary.c80 : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.neutral.c00 : theme.colors.neutral.c80};
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary.c80};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ApduView: React.FC = () => {
  const [history, setHistory] = useState<ApduHistoryItem[]>([]);
  const nonceRef = useRef(1);
  const [inputMode, setInputMode] = useState<InputMode>("builder");

  const dmk = useDmk();
  const selectedSessionId = useSelector(selectSelectedSessionId);

  const sendApdu = useCallback(
    async (apdu: Uint8Array): Promise<ApduHistoryItem> => {
      const rawApduResponse = await dmk.sendApdu({
        sessionId: selectedSessionId ?? "",
        apdu,
      });

      const newItem: ApduHistoryItem = {
        id: nonceRef.current++,
        date: new Date(),
        rawApduSent: apdu,
        response: rawApduResponse,
      };

      setHistory((prev) => [...prev, newItem]);
      return newItem;
    },
    [dmk, selectedSessionId],
  );

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const isDisabled = !selectedSessionId;

  return (
    <PageWithHeader title="APDU">
      <Flex flexDirection="column" rowGap={3} overflow="auto" flex={1} pb={5}>
        <Block data-testid="form_apdu-input">
          {/* Mode selector */}
          <Flex
            flexDirection="row"
            columnGap={2}
            rowGap={2}
            mb={4}
            flexWrap="wrap"
          >
            <SimpleTooltip
              content={
                <Text color="neutral.c00">
                  Build APDU commands using form fields and presets
                </Text>
              }
            >
              <ModeChip
                $active={inputMode === "builder"}
                onClick={() => setInputMode("builder")}
              >
                APDU Builder
              </ModeChip>
            </SimpleTooltip>
            <SimpleTooltip
              content={
                <Text color="neutral.c00">
                  Send a raw hexadecimal APDU directly
                </Text>
              }
            >
              <ModeChip
                $active={inputMode === "raw"}
                onClick={() => setInputMode("raw")}
              >
                Raw APDU
              </ModeChip>
            </SimpleTooltip>
            <SimpleTooltip
              content={
                <Text color="neutral.c00">Send multiple APDUs in sequence</Text>
              }
            >
              <ModeChip
                $active={inputMode === "bulk"}
                onClick={() => setInputMode("bulk")}
              >
                Bulk Exchange APDUs
              </ModeChip>
            </SimpleTooltip>
            <SimpleTooltip
              content={
                <Text color="neutral.c00">
                  Parse and extract fields from APDU responses
                </Text>
              }
            >
              <ModeChip
                $active={inputMode === "parser"}
                onClick={() => setInputMode("parser")}
              >
                APDU Response Parser
              </ModeChip>
            </SimpleTooltip>
          </Flex>

          {/* Mode components */}
          {inputMode === "builder" && (
            <BuilderModeInput sendApdu={sendApdu} disabled={isDisabled} />
          )}

          {inputMode === "raw" && (
            <RawHexModeInput sendApdu={sendApdu} disabled={isDisabled} />
          )}

          {inputMode === "bulk" && (
            <BulkModeInput sendApdu={sendApdu} disabled={isDisabled} />
          )}

          {inputMode === "parser" && <ResponseParserModeInput />}
        </Block>

        <ApduHistory history={history} onClear={handleClearHistory} />
      </Flex>
    </PageWithHeader>
  );
};
