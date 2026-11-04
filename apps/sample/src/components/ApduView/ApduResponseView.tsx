import React from "react";
import { type ApduResponse } from "@ledgerhq/device-management-kit";
import { cn } from "@ledgerhq/lumen-design-core/cn";

import { CopyableApdu, CopyableApduResponse } from "./CopyableApdu";

export type ApduHistoryItem = {
  id: number;
  date: Date;
  rawApduSent: Uint8Array;
  response: ApduResponse;
};

const ApduRow: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-row items-center gap-8 font-mono">{children}</div>
);

const ApduDirection: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="body-2 min-w-24 text-muted">{children}</span>
);

export const ApduResponseView: React.FC<{
  item: ApduHistoryItem;
  isLatest: boolean;
}> = ({ item, isLatest }) => {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-start gap-8 rounded-md p-12",
        isLatest ? "bg-muted-transparent" : "bg-transparent",
      )}
    >
      <span
        className={cn("text-muted", isLatest ? "body-3-semi-bold" : "body-3")}
      >
        #{item.id} - {item.date.toLocaleTimeString()}
      </span>
      <div className="flex w-full flex-col gap-8">
        <ApduRow>
          <ApduDirection>{"=>"}</ApduDirection>
          <CopyableApdu rawApdu={item.rawApduSent} />
        </ApduRow>
        <ApduRow>
          <ApduDirection>{"<="}</ApduDirection>
          <CopyableApduResponse response={item.response} />
        </ApduRow>
      </div>
    </div>
  );
};
