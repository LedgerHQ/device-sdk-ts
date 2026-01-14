import React, { useCallback, useEffect, useRef } from "react";
import { Button, Divider, Flex, Text } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";

import { type ApduHistoryItem, ApduResponseView } from "./ApduResponseView";
import { BoxHeader } from "./BoxHeader";
import { toPlainHexString } from "./hexUtils";

type ApduHistoryProps = {
  history: ApduHistoryItem[];
  onClear: () => void;
};

export const ApduHistory: React.FC<ApduHistoryProps> = ({
  history,
  onClear,
}) => {
  const historyBoxRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (historyBoxRef.current) {
      historyBoxRef.current.scrollTop = historyBoxRef.current.scrollHeight;
    }
  }, [history]);

  const handleClickCopyApdus = useCallback(() => {
    const content = history
      .map((item) => {
        const sentHex = toPlainHexString(item.rawApduSent);
        const receivedHex =
          toPlainHexString(item.response.data) +
          toPlainHexString(item.response.statusCode);
        return `=> ${sentHex}\n<= ${receivedHex}`;
      })
      .join("\n");
    void navigator.clipboard.writeText(content);
  }, [history]);

  const hintHistory = "History of APDUs sent through this page.";

  return (
    <Block overflow="hidden" flex={1} minHeight={200}>
      <BoxHeader hint={hintHistory}>APDU History</BoxHeader>
      <Flex
        ref={historyBoxRef}
        flexDirection="column"
        rowGap={4}
        overflowY="scroll"
        height="100%"
        flex={1}
        data-testid="box_apdu-history"
      >
        {history.length === 0 ? (
          <Flex
            flex={1}
            justifyContent="center"
            alignItems="center"
            color="neutral.c60"
          >
            <Text variant="body" color="neutral.c60">
              No APDUs sent yet
            </Text>
          </Flex>
        ) : (
          history.map((item, index, arr) => {
            const isLatest = index === arr.length - 1;
            return (
              <Flex flexDirection="column" key={item.id}>
                <ApduResponseView item={item} isLatest={isLatest} />
                <div hidden={isLatest}>
                  <Divider my={2} />
                </div>
              </Flex>
            );
          })
        )}
      </Flex>
      <Flex flexDirection="row" columnGap={3}>
        <Button
          variant="main"
          outline
          onClick={onClear}
          disabled={history.length === 0}
        >
          Clear history
        </Button>
        <Button
          variant="main"
          outline
          onClick={handleClickCopyApdus}
          disabled={history.length === 0}
        >
          Copy APDUs
        </Button>
      </Flex>
    </Block>
  );
};
