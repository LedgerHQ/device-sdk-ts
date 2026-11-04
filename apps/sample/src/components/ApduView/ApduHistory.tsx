import React, { useCallback, useEffect, useRef } from "react";
import { Button, Divider } from "@ledgerhq/lumen-ui-react";

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
    <Block className="min-h-[200px] flex-1 overflow-hidden">
      <BoxHeader hint={hintHistory}>APDU History</BoxHeader>
      <div
        className="flex flex-col gap-y-12 overflow-y-scroll h-full flex-1"
        ref={historyBoxRef}
        data-testid="box_apdu-history"
      >
        {history.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="body-2 text-muted">No APDUs sent yet</span>
          </div>
        ) : (
          history.map((item, index, arr) => {
            const isLatest = index === arr.length - 1;
            return (
              <div className="flex flex-col" key={item.id}>
                <ApduResponseView item={item} isLatest={isLatest} />
                <div hidden={isLatest}>
                  <Divider className="my-8" />
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex flex-row gap-x-8">
        <Button
          appearance="gray"
          onClick={onClear}
          disabled={history.length === 0}
        >
          Clear history
        </Button>
        <Button
          appearance="gray"
          onClick={handleClickCopyApdus}
          disabled={history.length === 0}
        >
          Copy APDUs
        </Button>
      </div>
    </Block>
  );
};
